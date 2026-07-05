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

module.exports = router;
