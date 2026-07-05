const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const User = require("../models/User");
const ZenVoiceDomainWhitelist = require("../models/ZenVoiceDomainWhitelist");
const { generatePseudonym, getPseudonymColor, issueZenVoiceToken } = require("../utils/zenVoiceHelper");
const { sendZenVoiceOTP } = require("../utils/mailService");

/**
 * GET /api/zenvoice/status
 * Returns the current user's ZenVoice verification status.
 * If already verified, re-issues a fresh ZenVoice session token.
 * Also handles the academic email fast-track on first check.
 */
router.get("/status", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select(
            "username email zenVoice"
        );
        if (!user) return res.status(404).json({ message: "User not found" });

        const zv = user.zenVoice || {};

        // Already verified — re-issue session token
        if (zv.isStudentVerified) {
            const token = issueZenVoiceToken(zv.pseudonym, zv.collegeEmailDomain);
            return res.json({
                isVerified: true,
                verificationMethod: zv.verificationMethod,
                pseudonym: zv.pseudonym,
                pseudonymColor: getPseudonymColor(zv.pseudonym),
                collegeName: zv.collegeName,
                domain: zv.collegeEmailDomain,
                sessionToken: token
            });
        }

        // Academic email fast-track: check if user's registered email domain is whitelisted
        if (user.email) {
            const emailDomain = user.email.split("@")[1]?.toLowerCase();
            if (emailDomain) {
                const whitelisted = await ZenVoiceDomainWhitelist.findOne({
                    domain: emailDomain,
                    status: "approved"
                });

                if (whitelisted) {
                    const pseudonym = await generatePseudonym();
                    user.zenVoice = {
                        ...zv,
                        isStudentVerified: true,
                        verificationMethod: "academic_email",
                        collegeName: whitelisted.institutionName,
                        collegeEmailDomain: emailDomain,
                        pseudonym
                    };
                    await user.save();

                    const token = issueZenVoiceToken(pseudonym, emailDomain);
                    return res.json({
                        isVerified: true,
                        verificationMethod: "academic_email",
                        pseudonym,
                        pseudonymColor: getPseudonymColor(pseudonym),
                        collegeName: whitelisted.institutionName,
                        domain: emailDomain,
                        sessionToken: token,
                        fastTracked: true
                    });
                }
            }
        }

        res.json({ isVerified: false, verificationMethod: zv.verificationMethod || "none" });
    } catch (err) {
        console.error("[ZenVoice] /status error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/verify/domain-otp/send
 * Sends a 6-digit OTP to the submitted institutional email.
 * If the domain is not whitelisted, creates a pending domain request.
 */
router.post("/verify/domain-otp/send", authMiddleware, async (req, res) => {
    try {
        const { institutionalEmail } = req.body;
        if (!institutionalEmail || !institutionalEmail.includes("@")) {
            return res.status(400).json({ message: "A valid institutional email is required" });
        }

        const domain = institutionalEmail.split("@")[1]?.toLowerCase();
        const user = await User.findById(req.user._id).select("username zenVoice verificationSession");

        if (user.zenVoice?.isStudentVerified) {
            return res.status(400).json({ message: "Already verified" });
        }

        const domainEntry = await ZenVoiceDomainWhitelist.findOne({ domain });

        if (!domainEntry || domainEntry.status !== "approved") {
            // Domain is unknown or pending — create/update pending entry
            if (!domainEntry) {
                await ZenVoiceDomainWhitelist.create({
                    domain,
                    institutionName: `Unknown Institution (${domain})`,
                    status: "pending",
                    submittedBy: user._id
                });
            }
            return res.status(202).json({
                domainPending: true,
                message: "Your institution domain has been submitted for admin review. You will be notified once approved."
            });
        }

        // Domain is approved — generate and send OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Reuse the verificationSession.emailOtpCode field, store domain alongside it
        user.verificationSession = {
            ...user.verificationSession,
            emailOtpCode: otp,
            emailOtpExpires: otpExpires,
            tempJwtToken: domain // repurpose to store target domain
        };
        await user.save();

        await sendZenVoiceOTP(institutionalEmail, user.username, otp, domain);

        res.json({ message: "Verification code sent to your institutional email.", domain });
    } catch (err) {
        console.error("[ZenVoice] /verify/domain-otp/send error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/verify/domain-otp/confirm
 * Validates the OTP. On success: generates pseudonym, sets verified, issues ZenVoice JWT.
 */
router.post("/verify/domain-otp/confirm", authMiddleware, async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ message: "OTP is required" });

        const user = await User.findById(req.user._id).select(
            "username email zenVoice verificationSession"
        );

        const session = user.verificationSession || {};
        const domain = session.tempJwtToken; // stored domain

        if (!session.emailOtpCode || !session.emailOtpExpires || !domain) {
            return res.status(400).json({ message: "No pending OTP. Please request a new code." });
        }

        if (new Date() > new Date(session.emailOtpExpires)) {
            return res.status(400).json({ message: "OTP has expired. Please request a new code." });
        }

        if (session.emailOtpCode !== String(otp).trim()) {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        const domainEntry = await ZenVoiceDomainWhitelist.findOne({ domain, status: "approved" });
        if (!domainEntry) {
            return res.status(400).json({ message: "Domain is no longer approved." });
        }

        const pseudonym = await generatePseudonym();
        user.zenVoice = {
            ...(user.zenVoice || {}),
            isStudentVerified: true,
            verificationMethod: "domain_otp",
            collegeName: domainEntry.institutionName,
            collegeEmailDomain: domain,
            pseudonym
        };

        // Clear the OTP session
        user.verificationSession = {
            emailOtpCode: null,
            emailOtpExpires: null,
            tempJwtToken: null
        };
        await user.save();

        const sessionToken = issueZenVoiceToken(pseudonym, domain);
        res.json({
            isVerified: true,
            pseudonym,
            pseudonymColor: getPseudonymColor(pseudonym),
            collegeName: domainEntry.institutionName,
            domain,
            sessionToken
        });
    } catch (err) {
        console.error("[ZenVoice] /verify/domain-otp/confirm error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

const crypto = require("crypto");
const zenVoiceAuth = require("../middleware/zenVoiceAuth");
const ZenVoiceRoom = require("../models/ZenVoiceRoom");
const ZenVoiceMessage = require("../models/ZenVoiceMessage");
const ZenVoiceReport = require("../models/ZenVoiceReport");
const { sendZenVoiceSuspensionEmail } = require("../utils/mailService");

/**
 * POST /api/zenvoice/pseudonym-request
 * Submit a request to change pseudonym (requires main ZenChat auth).
 */
router.post("/pseudonym-request", authMiddleware, async (req, res) => {
    try {
        const { desiredPseudonym } = req.body;
        if (!desiredPseudonym || desiredPseudonym.trim().length < 3 || desiredPseudonym.trim().length > 25) {
            return res.status(400).json({ message: "Desired pseudonym must be between 3 and 25 characters." });
        }
        const user = await User.findById(req.user._id);
        if (!user.zenVoice?.isStudentVerified) {
            return res.status(403).json({ message: "You must be verified to request pseudonym changes." });
        }
        const exists = await User.findOne({ "zenVoice.pseudonym": desiredPseudonym.trim() });
        if (exists) {
            return res.status(400).json({ message: "This pseudonym is already taken by another user." });
        }
        user.zenVoice.pseudonymChangeRequest = {
            requested: true,
            desiredPseudonym: desiredPseudonym.trim(),
            status: "pending",
            requestedAt: new Date()
        };
        await user.save();
        res.json({ message: "Pseudonym change request submitted to admin for approval." });
    } catch (err) {
        console.error("[ZenVoice] pseudonym-request error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * GET /api/zenvoice/rooms
 * List official rooms matching user's domain, plus private rooms containing user as member.
 */
router.get("/rooms", zenVoiceAuth, async (req, res) => {
    try {
        const domain = req.zenVoiceDomain;
        const pseudonym = req.zenVoicePseudonym;
        const rooms = await ZenVoiceRoom.find({
            $or: [
                { isOfficial: true, allowedDomain: domain },
                { isOfficial: false, members: pseudonym }
            ],
            isActive: true
        }).sort({ lastActivityAt: -1 });
        res.json({ rooms });
    } catch (err) {
        console.error("[ZenVoice] get rooms error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/rooms
 * Create a new private room.
 */
router.post("/rooms", zenVoiceAuth, async (req, res) => {
    try {
        const { name, description, lockToDomain } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: "Room name is required." });
        }
        const allowedDomain = lockToDomain ? req.zenVoiceDomain : "";
        const inviteToken = crypto.randomBytes(16).toString("hex");
        const room = await ZenVoiceRoom.create({
            name: name.trim(),
            description: description ? description.trim() : "",
            creatorPseudonym: req.zenVoicePseudonym,
            isOfficial: false,
            allowedDomain,
            inviteToken,
            members: [req.zenVoicePseudonym],
            memberCount: 1
        });
        res.status(201).json({ room });
    } catch (err) {
        console.error("[ZenVoice] create room error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * GET /api/zenvoice/rooms/search
 * Search official rooms by name (restricted by domain).
 */
router.get("/rooms/search", zenVoiceAuth, async (req, res) => {
    try {
        const { query } = req.query;
        const domain = req.zenVoiceDomain;
        const rooms = await ZenVoiceRoom.find({
            isOfficial: true,
            allowedDomain: domain,
            name: { $regex: query || "", $options: "i" },
            isActive: true
        }).limit(20);
        res.json({ rooms });
    } catch (err) {
        console.error("[ZenVoice] search rooms error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * GET /api/zenvoice/rooms/:roomId
 * Room metadata.
 */
router.get("/rooms/:roomId", zenVoiceAuth, async (req, res) => {
    try {
        const room = await ZenVoiceRoom.findOne({ _id: req.params.roomId, isActive: true });
        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.allowedDomain && room.allowedDomain !== req.zenVoiceDomain) {
            return res.status(403).json({ message: "Access denied: Restricted domain." });
        }
        res.json({ room });
    } catch (err) {
        console.error("[ZenVoice] get room error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/rooms/:roomId/join
 * Join an official room.
 */
router.post("/rooms/:roomId/join", zenVoiceAuth, async (req, res) => {
    try {
        const room = await ZenVoiceRoom.findOne({ _id: req.params.roomId, isActive: true });
        if (!room) return res.status(404).json({ message: "Room not found" });
        if (!room.isOfficial) {
            return res.status(400).json({ message: "Private rooms can only be joined via invite link." });
        }
        if (room.allowedDomain && room.allowedDomain !== req.zenVoiceDomain) {
            return res.status(403).json({ message: "Access denied: Restricted domain." });
        }
        if (!room.members.includes(req.zenVoicePseudonym)) {
            room.members.push(req.zenVoicePseudonym);
            room.memberCount = room.members.length;
            await room.save();
        }
        res.json({ success: true, room });
    } catch (err) {
        console.error("[ZenVoice] join room error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/rooms/invite/:token
 * Join a private room via invite link.
 */
router.post("/rooms/invite/:token", zenVoiceAuth, async (req, res) => {
    try {
        const room = await ZenVoiceRoom.findOne({ inviteToken: req.params.token, isActive: true });
        if (!room) return res.status(404).json({ message: "Invalid invite link." });
        if (room.allowedDomain && room.allowedDomain !== req.zenVoiceDomain) {
            return res.status(403).json({ message: "Access denied: Restricted domain." });
        }
        if (!room.members.includes(req.zenVoicePseudonym)) {
            room.members.push(req.zenVoicePseudonym);
            room.memberCount = room.members.length;
            await room.save();
        }
        res.json({ success: true, room });
    } catch (err) {
        console.error("[ZenVoice] join invite error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/rooms/:roomId/leave
 * Leave a room. Atomic pull and clean check.
 */
router.post("/rooms/:roomId/leave", zenVoiceAuth, async (req, res) => {
    try {
        const room = await ZenVoiceRoom.findOneAndUpdate(
            { _id: req.params.roomId, isActive: true },
            { $pull: { members: req.zenVoicePseudonym } },
            { new: true }
        );
        if (!room) return res.status(404).json({ message: "Room not found" });
        room.memberCount = room.members.length;
        await room.save();
        if (!room.isOfficial && room.members.length === 0) {
            await ZenVoiceRoom.findByIdAndDelete(room._id);
            await ZenVoiceMessage.deleteMany({ roomId: room._id });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("[ZenVoice] leave room error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * GET /api/zenvoice/rooms/:roomId/messages
 * Fetch messages for a room.
 */
router.get("/rooms/:roomId/messages", zenVoiceAuth, async (req, res) => {
    try {
        const { before } = req.query;
        const room = await ZenVoiceRoom.findOne({ _id: req.params.roomId, isActive: true });
        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.allowedDomain && room.allowedDomain !== req.zenVoiceDomain) {
            return res.status(403).json({ message: "Access denied." });
        }
        const query = { roomId: room._id, deletedAt: null };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }
        const messages = await ZenVoiceMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ messages: messages.reverse() });
    } catch (err) {
        console.error("[ZenVoice] get messages error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/message/:messageId/restrict
 * Soft-restrict a message.
 */
router.post("/message/:messageId/restrict", zenVoiceAuth, async (req, res) => {
    try {
        const message = await ZenVoiceMessage.findById(req.params.messageId);
        if (!message) return res.status(404).json({ message: "Message not found" });
        const room = await ZenVoiceRoom.findById(message.roomId);
        if (!room) return res.status(404).json({ message: "Room not found" });
        if (message.restrictedBy.includes(req.zenVoicePseudonym)) {
            return res.status(400).json({ message: "You have already restricted this message." });
        }
        message.restrictedBy.push(req.zenVoicePseudonym);
        const threshold = room.memberCount <= 49 ? 3 : 5;
        let blurTriggered = false;
        if (message.restrictedBy.length >= threshold && !message.globalBlur) {
            message.globalBlur = true;
            blurTriggered = true;
            const creator = await User.findOne({ "zenVoice.pseudonym": message.pseudonym });
            if (creator) {
                creator.zenVoice.zenVoiceRedCardCount = (creator.zenVoice.zenVoiceRedCardCount || 0) + 1;
                const rcc = creator.zenVoice.zenVoiceRedCardCount;
                let durationHours = 0;
                if (rcc === 1) durationHours = 1;
                else if (rcc === 2) durationHours = 6;
                else if (rcc === 3) durationHours = 12;
                else if (rcc === 4) durationHours = 24;
                else if (rcc === 5) durationHours = 72;
                else if (rcc === 6) durationHours = 168;
                else durationHours = 87600;
                creator.zenVoice.zenVoiceSuspendedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
                await creator.save();
                const io = req.app.get("io");
                io.of("/zenvoice").to(creator._id.toString()).emit("red_card_warning", {
                    redCardCount: rcc,
                    suspendedUntil: creator.zenVoice.zenVoiceSuspendedUntil
                });
            }
        }
        await message.save();
        const io = req.app.get("io");
        io.of("/zenvoice").to(room._id.toString()).emit("message_restricted", {
            messageId: message._id,
            restrictedByCount: message.restrictedBy.length,
            globalBlur: message.globalBlur
        });
        res.json({ success: true, restrictedByCount: message.restrictedBy.length, globalBlur: message.globalBlur });
    } catch (err) {
        console.error("[ZenVoice] restrict error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/message/:messageId/report
 * Formally report a message.
 */
router.post("/message/:messageId/report", zenVoiceAuth, async (req, res) => {
    try {
        const { reason, evidence } = req.body;
        if (!reason) return res.status(400).json({ message: "Reason is required." });
        const message = await ZenVoiceMessage.findById(req.params.messageId);
        if (!message) return res.status(404).json({ message: "Message not found" });
        const reportExists = await ZenVoiceReport.findOne({
            messageId: message._id,
            reporterPseudonym: req.zenVoicePseudonym
        });
        if (reportExists) {
            return res.status(400).json({ message: "You have already reported this message." });
        }
        const report = await ZenVoiceReport.create({
            roomId: message.roomId,
            reportedPseudonym: message.pseudonym,
            reporterPseudonym: req.zenVoicePseudonym,
            messageId: message._id,
            reason,
            evidence: evidence || ""
        });
        const distinctReports = await ZenVoiceReport.distinct("reporterPseudonym", {
            reportedPseudonym: message.pseudonym,
            status: "pending"
        });
        if (distinctReports.length >= 3) {
            const userToSuspend = await User.findOne({ "zenVoice.pseudonym": message.pseudonym });
            if (userToSuspend && !userToSuspend.isSuspended) {
                userToSuspend.isSuspended = true;
                await userToSuspend.save();
                const io = req.app.get("io");
                io.to(userToSuspend._id.toString()).emit("force_logout", { reason: "community_suspension" });
                if (userToSuspend.email) {
                    await sendZenVoiceSuspensionEmail(userToSuspend.email, userToSuspend.username, message.pseudonym)
                        .catch(e => console.error("[ZenVoice] suspension email fail:", e));
                }
            }
        }
        res.json({ success: true, reportId: report._id });
    } catch (err) {
        console.error("[ZenVoice] report error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/report/:reportId/counter
 * Counter-report.
 */
router.post("/report/:reportId/counter", zenVoiceAuth, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ message: "Counter-report reason is required." });
        const report = await ZenVoiceReport.findById(req.params.reportId);
        if (!report) return res.status(404).json({ message: "Report not found." });
        if (report.reportedPseudonym !== req.zenVoicePseudonym) {
            return res.status(403).json({ message: "You can only counter-report reports filed against you." });
        }
        report.counterReporterPseudonym = req.zenVoicePseudonym;
        report.counterReportReason = reason;
        await report.save();
        res.json({ success: true, message: "Counter-report filed." });
    } catch (err) {
        console.error("[ZenVoice] counter report error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * POST /api/zenvoice/bridge-dm/:targetPseudonym
 * Creates a silent DM chat between current user and user of targetPseudonym.
 * Bypasses push notifications.
 */
router.post("/bridge-dm/:targetPseudonym", zenVoiceAuth, async (req, res) => {
    try {
        const targetPseudonym = req.params.targetPseudonym;
        const currentPseudonym = req.zenVoicePseudonym;

        if (targetPseudonym === currentPseudonym) {
            return res.status(400).json({ message: "You cannot DM yourself." });
        }

        const [currentUser, targetUser] = await Promise.all([
            User.findOne({ "zenVoice.pseudonym": currentPseudonym }),
            User.findOne({ "zenVoice.pseudonym": targetPseudonym })
        ]);

        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        const Chat = require("../models/Chat");
        let chat = await Chat.findOne({
            isGroup: false,
            participants: { $all: [currentUser._id, targetUser._id] }
        });

        if (!chat) {
            chat = await Chat.create({
                participants: [currentUser._id, targetUser._id],
                isGroup: false
            });

            const Message = require("../models/Message");
            const message = await Message.create({
                chatId: chat._id,
                senderId: currentUser._id,
                content: "👋 Connection request initiated from #ZenVoice.",
                type: "text",
                status: "delivered"
            });

            chat.lastMessage = message._id;
            await chat.save();

            const io = req.app.get("io");
            if (io) {
                const populated = await Chat.findById(chat._id)
                    .populate("participants", "username avatar bio isOnline lastSeen isVerified createdAt privacySettings contacts")
                    .populate({
                        path: "lastMessage",
                        populate: { path: "senderId", select: "username" }
                    });

                io.to(targetUser._id.toString()).emit("new_chat", { chat: populated });
            }
        }

        res.json({ success: true, chatId: chat._id });
    } catch (err) {
        console.error("[ZenVoice] DM Bridge error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;

