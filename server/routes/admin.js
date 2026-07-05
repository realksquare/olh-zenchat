const express = require("express");
const User = require("../models/User");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");
const { sendPushNotification } = require("../utils/firebase");

const router = express.Router();

const adminCheck = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user || (user.role !== "co_admin" && user.role !== "master_admin")) {
            return res.status(403).json({ message: "Admin access denied" });
        }
        req.adminUser = user;
        next();
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

router.get("/stats", authMiddleware, adminCheck, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalChats = 0;
        const messagesCount = await Message.countDocuments();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dauCount = await User.countDocuments({
            $or: [
                { isOnline: true },
                { lastSeen: { $gte: today } }
            ]
        });

        res.json({
            totalUsers,
            totalChats,
            messagesCount,
            dauCount,
            serverStatus: {
                render: "Online",
                vercel: "Online"
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/users", authMiddleware, adminCheck, async (req, res) => {
    try {
        const users = await User.find({}, "-password").sort({ createdAt: -1 });
        res.json({ users });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/verify/:userId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: "User not found" });
        user.isVerified = !user.isVerified;
        await user.save();
        res.json({ user: user.toPublicJSON() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/role/:userId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const { role } = req.body;
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        if (targetUser.username === "admin_krish") {
            return res.status(403).json({ message: "Cannot modify master admin" });
        }

        if (req.adminUser.role !== "master_admin" && role === "master_admin") {
            return res.status(403).json({ message: "Only master admin can promote to master" });
        }

        targetUser.role = role;
        await targetUser.save();
        res.json({ user: targetUser.toPublicJSON() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/suspend/:userId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        if (targetUser.username === "admin_krish") {
            return res.status(403).json({ message: "Cannot suspend master admin" });
        }

        targetUser.isSuspended = !targetUser.isSuspended;
        await targetUser.save();

        if (targetUser.isSuspended) {
            const io = req.app.get("io");
            io.to(targetUser._id.toString()).emit("force_logout", { reason: "account_suspended" });
        }

        res.json({ user: { ...targetUser.toPublicJSON(), isSuspended: targetUser.isSuspended } });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/users/:userId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        if (targetUser.username === "admin_krish") {
            return res.status(403).json({ message: "Cannot delete master admin" });
        }

        await User.findByIdAndDelete(req.params.userId);

        const io = req.app.get("io");
        io.to(req.params.userId).emit("force_logout", { reason: "account_deleted" });

        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/push", authMiddleware, adminCheck, async (req, res) => {
    try {
        const { title, body } = req.body;
        if (!title || !body) return res.status(400).json({ message: "Title and body required" });

        const users = await User.find({ "fcmTokens.0": { $exists: true } });
        const promises = [];
        
        for (const u of users) {
            for (const t of u.fcmTokens) {
                if (t.token) {
                    promises.push(
                        sendPushNotification(u._id, t.token, title, body, { tag: "admin-broadcast" })
                            .then(success => success ? 1 : 0)
                            .catch(err => {
                                console.error(`Error sending broadcast notification to user ${u._id}:`, err);
                                return 0;
                            })
                    );
                }
            }
        }
        const results = await Promise.all(promises);
        const sentCount = results.reduce((acc, curr) => acc + curr, 0);
        res.json({ message: "Push sent successfully", sentCount });
    } catch (err) {
        console.error("Broadcast push error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── ZenVoice Admin Routes ───────────────────────────────────────────────────

const ZenVoiceDomainWhitelist = require("../models/ZenVoiceDomainWhitelist");
const { sendZenVoicePseudonymResult, sendZenVoiceDomainResult } = require("../utils/mailService");

// GET /api/admin/zenvoice/pseudonym-requests
router.get("/zenvoice/pseudonym-requests", authMiddleware, adminCheck, async (req, res) => {
    try {
        const users = await User.find({ "zenVoice.pseudonymChangeRequest.requested": true })
            .select("username email zenVoice.pseudonym zenVoice.pseudonymChangeRequest");
        const requests = users.map(u => ({
            _id: u._id,
            username: u.username,
            email: u.email,
            currentPseudonym: u.zenVoice?.pseudonym || "",
            desiredPseudonym: u.zenVoice?.pseudonymChangeRequest?.desiredPseudonym || "",
            requestedAt: u.zenVoice?.pseudonymChangeRequest?.requestedAt
        }));
        res.json({ requests });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/admin/zenvoice/pseudonym-requests/:userId
router.post("/zenvoice/pseudonym-requests/:userId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const { action, adminNote } = req.body;
        if (!["approve", "reject"].includes(action)) {
            return res.status(400).json({ message: "Invalid action" });
        }

        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const { desiredPseudonym } = user.zenVoice?.pseudonymChangeRequest || {};
        if (!desiredPseudonym) return res.status(400).json({ message: "No pending request" });

        if (action === "approve") {
            user.zenVoice.pseudonym = desiredPseudonym;
        }
        user.zenVoice.pseudonymChangeRequest = {
            requested: false,
            desiredPseudonym: "",
            status: action === "approve" ? "approved" : "rejected",
            adminNote: adminNote || "",
            requestedAt: null
        };
        await user.save();

        if (user.email) {
            await sendZenVoicePseudonymResult(
                user.email, user.username, desiredPseudonym,
                action === "approve", adminNote || ""
            ).catch(err => console.error("[Admin] ZV pseudonym email error:", err));
        }

        res.json({ message: "Request processed" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// GET /api/admin/zenvoice/domain-requests
router.get("/zenvoice/domain-requests", authMiddleware, adminCheck, async (req, res) => {
    try {
        const domains = await ZenVoiceDomainWhitelist.find({ status: "pending" })
            .populate("submittedBy", "username email")
            .sort({ createdAt: 1 });
        res.json({ domains });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/admin/zenvoice/domain-requests/:domainId
router.post("/zenvoice/domain-requests/:domainId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const { action, adminNote } = req.body;
        if (!["approve", "reject"].includes(action)) {
            return res.status(400).json({ message: "Invalid action" });
        }

        const domainEntry = await ZenVoiceDomainWhitelist.findById(req.params.domainId)
            .populate("submittedBy", "username email");
        if (!domainEntry) return res.status(404).json({ message: "Domain request not found" });

        domainEntry.status = action === "approve" ? "approved" : "rejected";
        domainEntry.reviewedBy = req.user._id;
        domainEntry.reviewedAt = new Date();
        await domainEntry.save();

        if (domainEntry.submittedBy?.email) {
            await sendZenVoiceDomainResult(
                domainEntry.submittedBy.email, domainEntry.submittedBy.username,
                domainEntry.domain, action === "approve", adminNote || ""
            ).catch(err => console.error("[Admin] ZV domain email error:", err));
        }

        res.json({ message: "Domain request processed" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
