const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { upload, cloudinary } = require("../utils/cloudinary");
const crypto = require("crypto");
const { sendResetEmail, send2faEmail } = require("../utils/mailService");
const { verifyFirebaseIdToken } = require("../utils/firebase");

const router = express.Router();

const generateToken = (user) => {
    return jwt.sign(
        { _id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    return `${name[0]}***@${domain}`;
};

const maskPhone = (phone) => {
    if (!phone) return "";
    return `${phone.substring(0, 3)}******${phone.substring(phone.length - 2)}`;
};

const getWebOtpDomain = (req) => {
    try {
        const origin = req.get("origin") || req.get("referer");
        if (origin) {
            const url = new URL(origin);
            return url.hostname;
        }
    } catch (e) {
        // Fallback
    }
    return "zenchat.app";
};



// 4. Verify 2FA OTP (For secondary factor)
router.post("/verify-2fa-otp", async (req, res) => {
    try {
        const { userId, otpCode } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const session = user.verificationSession;
        if (!session) {
            return res.status(400).json({ message: "No active verification session" });
        }

        if (!otpCode) {
            return res.status(400).json({ message: "Verification code is required" });
        }

        const isValidOtp = session.otpCode && session.otpCode === otpCode && new Date() <= new Date(session.otpExpires);

        if (!isValidOtp) {
            return res.status(400).json({ message: "Invalid or expired verification code" });
        }

        // Clear session
        user.verificationSession = undefined;
        await user.save();

        // Login complete
        await User.findByIdAndUpdate(user._id, { isOnline: true });
        const populatedUser = await User.findById(user._id)
            .populate("blockedUsers.userId", "username avatar")
            .populate("contacts.userId", "username avatar fullName");
        const token = generateToken(user);

        res.json({ token, user: populatedUser.toPrivateJSON() });
    } catch (err) {
        console.error("Verify 2FA OTP error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// 5. Generate Cryptographic E2EE Bypass Challenge
router.post("/challenge", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.publicKey) {
            return res.status(400).json({ message: "No E2EE public key is registered for this user" });
        }

        const challenge = crypto.randomBytes(32).toString("hex");

        // Save challenge inside verification session
        user.verificationSession = {
            otpCode: challenge, // Store the challenge text in otpCode for simplicity
            otpExpires: new Date(Date.now() + 5 * 60 * 1000)
        };
        await user.save();

        // Cryptographically encrypt challenge using user's registered RSA-OAEP public JWK key
        const publicKeyObject = crypto.createPublicKey({
            key: user.publicKey,
            format: "jwk"
        });

        const encryptedBuffer = crypto.publicEncrypt(
            {
                key: publicKeyObject,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256"
            },
            Buffer.from(challenge)
        );

        res.json({
            encryptedChallenge: encryptedBuffer.toString("hex"),
            cryptoSalt: user.cryptoSalt,
            encryptedPrivateKeyBackup: user.encryptedPrivateKeyBackup
        });
    } catch (err) {
        console.error("Challenge generation error:", err);
        res.status(500).json({ message: "Server error: E2EE verification setup failed" });
    }
});

// 6. Verify Decrypted Challenge (Bypasses 2FA via E2EE Key ownership proof)
router.post("/verify-challenge", async (req, res) => {
    try {
        const { userId, decryptedChallenge } = req.body;
        if (!userId || !decryptedChallenge) {
            return res.status(400).json({ message: "User ID and decrypted challenge are required" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const session = user.verificationSession;
        if (!session || !session.otpCode || session.otpCode !== decryptedChallenge) {
            return res.status(400).json({ message: "Cryptographic bypass verification failed: challenge mismatch" });
        }

        if (new Date() > new Date(session.otpExpires)) {
            return res.status(400).json({ message: "Bypass challenge session has expired" });
        }

        // Clear session
        user.verificationSession = undefined;
        await user.save();

        // Complete E2EE verification & login
        await User.findByIdAndUpdate(user._id, { isOnline: true });
        const populatedUser = await User.findById(user._id)
            .populate("blockedUsers.userId", "username avatar")
            .populate("contacts.userId", "username avatar fullName");
        const token = generateToken(user);

        res.json({ token, user: populatedUser.toPrivateJSON() });
    } catch (err) {
        console.error("Challenge verification error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post(
    "/register",
    [
        body("username").trim().isLength({ min: 3, max: 20 }).matches(/^[a-z0-9_]+$/).withMessage("Username can only contain lowercase letters, numbers, and underscores"),
        body("email").isEmail().normalizeEmail(),
        body("password").isLength({ min: 7, max: 18 }).matches(/\d/).withMessage("Password must contain at least one number"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { username, email, password, referredBy } = req.body;

            const existingUser = await User.findOne({
                $or: [{ email }, { username }],
            });

            if (existingUser) {
                return res.status(409).json({ message: "Username or email already taken" });
            }

            // Check for disposable email domains
            const disposableDomains = require("disposable-email-domains");
            const domain = email.split("@")[1]?.toLowerCase();
            if (disposableDomains.includes(domain)) {
                return res.status(400).json({ message: "Registration from temporary or disposable email providers is not allowed" });
            }

            const user = await User.create({ username, email, password });
            
            if (referredBy) {
                try {
                    const referrer = await User.findOne({ username: referredBy });
                    if (referrer) {
                        user.contacts.push({ userId: referrer._id, tag: "general" });
                        await user.save();

                        // Increment referral registrations for referrer
                        referrer.referralStats.registrations += 1;
                        await referrer.save();

                        // Add user to referrer's contacts as well
                        referrer.contacts.push({ userId: user._id, tag: "general" });
                        await referrer.save();

                        // Create a private chat between them
                        const Chat = require("../models/Chat");
                        const Message = require("../models/Message");
                        let chat = await Chat.findOne({
                            isGroup: false,
                            participants: { $all: [user._id, referrer._id] }
                        });

                        if (!chat) {
                            chat = await Chat.create({
                                participants: [user._id, referrer._id],
                                isGroup: false
                            });
                        }

                        // Send welcome message
                        const msgContent = `Hey! I just joined ZenChat using your invite link! 🎉`;
                        await Message.create({
                            chatId: chat._id,
                            senderId: user._id,
                            content: msgContent,
                            type: "text",
                            status: "sent"
                        });
                    }
                } catch (err) {
                    console.error("Referral processing error:", err);
                }
            }

            res.status(201).json({
                message: "User created successfully",
                token: generateToken(user),
                user: user.toPrivateJSON(),
            });
        } catch (error) {
            console.error("Registration error:", error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// @route   POST /api/auth/referral/click/:username
// @desc    Track a referral link click
// @access  Public
router.post("/referral/click/:username", async (req, res) => {
    try {
        const { username } = req.params;
        await User.findOneAndUpdate(
            { username },
            { $inc: { "referralStats.clicks": 1 } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Error tracking click" });
    }
});
router.post(
    "/login",
    [
        body("email").isEmail().normalizeEmail(),
        body("password").notEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: "Invalid credentials" });
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid credentials" });
            }

            if (user.isSuspended) {
                return res.status(403).json({ 
                    message: "Account Suspended", 
                    isSuspended: true 
                });
            }

            // Check if 2FA is active
            if (user.is2faEnabled) {
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                
                await send2faEmail(user.email, user.username, otp);

                user.verificationSession = {
                    otpCode: otp,
                    otpExpires: new Date(Date.now() + 5 * 60 * 1000)
                };
                await user.save();

                return res.json({
                    mfaRequired: true,
                    mfaType: "email",
                    emailMasked: maskEmail(user.email),
                    userId: user._id
                });
            }

            await User.findByIdAndUpdate(user._id, { isOnline: true });
            const populatedUser = await User.findById(user._id)
                .populate("blockedUsers.userId", "username avatar")
                .populate("contacts.userId", "username avatar fullName");
            const token = generateToken(user);

            res.json({ token, user: populatedUser.toPrivateJSON() });
        } catch (err) {
            console.error("Login error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.post("/resend-mfa", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: "userId is required" });

        const user = await User.findById(userId);
        if (!user || !user.is2faEnabled) {
            return res.status(400).json({ message: "Invalid user or MFA not enabled" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        await send2faEmail(user.email, user.username, otp);

        user.verificationSession = {
            otpCode: otp,
            otpExpires: new Date(Date.now() + 5 * 60 * 1000)
        };
        await user.save();

        res.json({ success: true, message: "Verification code resent." });
    } catch (err) {
        console.error("[Resend MFA] error:", err);
        res.status(500).json({ message: "Server error" });
    }
});


router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("blockedUsers.userId", "username avatar")
            .populate("contacts.userId", "username avatar fullName");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ user: user.toPrivateJSON() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/logout", authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            isOnline: false,
            lastSeen: new Date(),
        });
        res.json({ message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Request 2FA Setup OTP
router.post("/2fa/setup/request", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const emailTarget = user.email ? user.email.trim().toLowerCase() : "";
        if (!emailTarget) {
            return res.status(400).json({ message: "An email address is required to configure 2FA" });
        }

        // Generate 6-digit OTP code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        user.verificationSession = {
            otpCode,
            otpExpires: expires
        };
        await user.save();

        await send2faEmail(emailTarget, user.username, otpCode);
        res.json({ message: `Verification code sent to email ${emailTarget}` });
    } catch (err) {
        console.error("2FA request setup error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Verify and enable 2FA
router.post("/2fa/setup/verify", authMiddleware, async (req, res) => {
    try {
        const { otpCode } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!otpCode) {
            return res.status(400).json({ message: "Verification code is required" });
        }

        const session = user.verificationSession;
        if (!session || !session.otpCode || session.otpCode !== otpCode) {
            return res.status(400).json({ message: "Invalid verification code" });
        }
        if (new Date() > new Date(session.otpExpires)) {
            return res.status(400).json({ message: "Verification code has expired" });
        }

        // Code is valid! Enable 2FA and save settings
        user.is2faEnabled = true;
        user.mfaPreference = "email";
        user.verificationSession = undefined;
        await user.save();

        const populated = await User.findById(user._id).populate("blockedUsers.userId", "username avatar");
        res.json({ message: "2FA successfully enabled!", user: populated.toPrivateJSON() });
    } catch (err) {
        console.error("2FA verify setup error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.put(
    "/me",
    authMiddleware,
    upload.single("avatar"),
    [
        body("username").optional().trim().isLength({ min: 3, max: 20 }),
        body("email").optional().isEmail().normalizeEmail(),
        body("password").optional().isLength({ min: 7, max: 18 }).matches(/\d/).withMessage("Password must contain at least one number"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { username, email, password, notificationsEnabled, fcmToken, timezone } = req.body;
            const user = await User.findById(req.user._id);

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            if (timezone) {
                user.timezone = timezone;
            }

            if (email && email !== user.email) {
                const existing = await User.findOne({ email });
                if (existing) {
                    return res.status(409).json({ message: "Email already taken" });
                }
                user.email = email;
            }

            if (username && username !== user.username) {
                const existing = await User.findOne({ username });
                if (existing) {
                    return res.status(409).json({ message: "Username already taken" });
                }
                user.username = username;
            }

            if (password) {
                user.password = password;
            }

            if (notificationsEnabled !== undefined) {
                user.notificationsEnabled = notificationsEnabled === 'true' || notificationsEnabled === true;
            }

            if (fcmToken !== undefined) {
                const deviceType = req.body.deviceType || 'browser';
                const tokens = (user.fcmTokens || []).filter(t => t.token !== fcmToken && t.deviceType !== deviceType);
                tokens.push({
                    token: fcmToken,
                    deviceType: deviceType,
                    lastUpdated: new Date()
                });
                user.fcmTokens = tokens;
            }

            if (req.file && req.file.path) {
                try {
                    const result = await cloudinary.uploader.upload(req.file.path, {
                        folder: "zenchat_avatars",
                        resource_type: "image"
                    });
                    user.avatar = result.secure_url;
                } catch (cloudErr) {
                    console.error("[Auth] Avatar upload failed:", cloudErr);
                    return res.status(500).json({ message: "Avatar upload failed" });
                }
            } else if (req.body.clearAvatar === 'true' || req.body.clearAvatar === true) {
                user.avatar = "";
            }

            if (req.body.fullName !== undefined) {
                user.fullName = req.body.fullName;
            }

            if (req.body.bio !== undefined) {
                user.bio = req.body.bio;
            }

            if (req.body.phoneNumber !== undefined) {
                const newPhone = req.body.phoneNumber ? req.body.phoneNumber.trim() : "";
                if (newPhone && newPhone !== user.phoneNumber) {
                    const existing = await User.findOne({ phoneNumber: newPhone });
                    if (existing) {
                        return res.status(409).json({ message: "Phone number already registered to another account" });
                    }
                }
                user.phoneNumber = newPhone || undefined;
            }

            if (req.body.is2faEnabled !== undefined) {
                const enabled = req.body.is2faEnabled === 'true' || req.body.is2faEnabled === true;
                if (enabled && !user.email) {
                    return res.status(400).json({ message: "An email address is required to enable 2FA" });
                }
                user.is2faEnabled = enabled;
            }

            if (req.body.mfaPreference !== undefined) {
                user.mfaPreference = req.body.mfaPreference;
            }

            if (req.body.privacySettings) {
                const settings = typeof req.body.privacySettings === 'string' 
                    ? JSON.parse(req.body.privacySettings) 
                    : req.body.privacySettings;
                user.privacySettings = { ...user.privacySettings, ...settings };
            }

            await user.save();
            const populatedUser = await User.findById(user._id)
                .populate("blockedUsers.userId", "username avatar")
                .populate("contacts.userId", "username avatar fullName");
            res.json({ user: populatedUser.toPrivateJSON() });
        } catch (err) {
            console.error("[Auth] Update error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.post("/contacts/:targetId", authMiddleware, async (req, res) => {
    try {
        const { targetId } = req.params;
        const me = await User.findById(req.user._id);
        if (!me) return res.status(404).json({ message: "User not found" });
        if (targetId === req.user._id.toString()) {
            return res.status(400).json({ message: "Cannot add yourself" });
        }
        const already = me.contacts.find(c => c.userId?.toString() === targetId);
        if (already) {
            const populatedMe = await User.findById(me._id)
                .populate("blockedUsers.userId", "username avatar")
                .populate("contacts.userId", "username avatar fullName");
            return res.json({ user: populatedMe.toPrivateJSON() });
        }
        me.contacts.push({ userId: targetId, tag: "general" });
        await me.save();
        const populatedMe = await User.findById(me._id)
            .populate("blockedUsers.userId", "username avatar")
            .populate("contacts.userId", "username avatar fullName");
        res.json({ user: populatedMe.toPrivateJSON() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/contacts/:targetId", authMiddleware, async (req, res) => {
    try {
        const { targetId } = req.params;
        const me = await User.findById(req.user._id);
        if (!me) return res.status(404).json({ message: "User not found" });
        me.contacts = me.contacts.filter(c => c.userId?.toString() !== targetId);
        await me.save();
        const populatedMe = await User.findById(me._id)
            .populate("blockedUsers.userId", "username avatar")
            .populate("contacts.userId", "username avatar fullName");
        res.json({ user: populatedMe.toPrivateJSON() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/auth/block/:targetId
// @desc    Block a user
// @access  Private
router.post("/block/:targetId", authMiddleware, async (req, res) => {
    try {
        const { targetId } = req.params;
        const me = await User.findById(req.user._id);
        if (!me) return res.status(404).json({ message: "User not found" });
        if (targetId === req.user._id.toString()) {
            return res.status(400).json({ message: "Cannot block yourself" });
        }

        const targetUser = await User.findById(targetId);
        if (!targetUser) return res.status(404).json({ message: "User to block not found" });

        // Cooldown check for unblocking (if previously unblocked)
        const unblockedEntry = me.unblockedUsers.find(u => u.userId.toString() === targetId);
        if (unblockedEntry) {
            const diffMs = Date.now() - new Date(unblockedEntry.unblockedAt).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            if (diffHours < 7) {
                const remainingHours = Math.ceil(7 - diffHours);
                return res.status(400).json({ 
                    message: `Cannot block this user yet. Cooldown active. Please wait ${remainingHours} more hour(s).` 
                });
            }
        }

        // Add to blockedUsers if not already there
        const alreadyBlocked = me.blockedUsers.some(u => u.userId.toString() === targetId);
        if (!alreadyBlocked) {
            me.blockedUsers.push({ userId: targetId, blockedAt: new Date() });
        }

        // Clean up from unblockedUsers
        me.unblockedUsers = me.unblockedUsers.filter(u => u.userId.toString() !== targetId);

        await me.save();

        // Emit block event via Socket.IO
        const io = req.app.get("io");
        if (io) {
            io.to(me._id.toString()).emit("user_blocked", { blockerId: me._id.toString(), blockedId: targetId });
            io.to(targetId).emit("user_blocked", { blockerId: me._id.toString(), blockedId: targetId });
        }

        const populatedMe = await User.findById(me._id)
            .populate("blockedUsers.userId", "username avatar")
            .populate("contacts.userId", "username avatar fullName");
        res.json({ user: populatedMe.toPrivateJSON() });
    } catch (err) {
        console.error("Block user error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/auth/unblock/:targetId
// @desc    Unblock a user
// @access  Private
router.post("/unblock/:targetId", authMiddleware, async (req, res) => {
    try {
        const { targetId } = req.params;
        const me = await User.findById(req.user._id);
        if (!me) return res.status(404).json({ message: "User not found" });

        const blockedEntry = me.blockedUsers.find(u => u.userId.toString() === targetId);
        if (!blockedEntry) {
            return res.status(400).json({ message: "User is not blocked" });
        }

        // Cooldown check for blocking
        const diffMs = Date.now() - new Date(blockedEntry.blockedAt).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < 7) {
            const remainingHours = Math.ceil(7 - diffHours);
            return res.status(400).json({ 
                message: `Cannot unblock this user yet. Cooldown active. Please wait ${remainingHours} more hour(s).` 
            });
        }

        // Remove from blockedUsers
        me.blockedUsers = me.blockedUsers.filter(u => u.userId.toString() !== targetId);

        // Add/update unblockedUsers entry
        me.unblockedUsers = me.unblockedUsers.filter(u => u.userId.toString() !== targetId);
        me.unblockedUsers.push({ userId: targetId, unblockedAt: new Date() });

        await me.save();

        // Emit unblock event via Socket.IO
        const io = req.app.get("io");
        if (io) {
            io.to(me._id.toString()).emit("user_unblocked", { blockerId: me._id.toString(), blockedId: targetId });
            io.to(targetId).emit("user_unblocked", { blockerId: me._id.toString(), blockedId: targetId });
        }

        const populatedMe = await User.findById(me._id)
            .populate("blockedUsers.userId", "username avatar")
            .populate("contacts.userId", "username avatar fullName");
        res.json({ user: populatedMe.toPrivateJSON() });
    } catch (err) {
        console.error("Unblock user error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/forgot-password", async (req, res) => {
    try {
        const { identifier, method } = req.body;
        if (!identifier) {
            return res.status(400).json({ message: "Email or Phone Number is required" });
        }

        const input = identifier.trim();
        let user = null;
        if (input.includes("@")) {
            user = await User.findOne({ email: input.toLowerCase() });
        } else {
            user = await User.findOne({ phoneNumber: input });
        }

        if (!user) {
            return res.status(404).json({ message: "No account found with this identifier" });
        }

        // If the user has 2FA enabled, and they did not specify a choice yet, return the choices!
        if (user.is2faEnabled && !method) {
            return res.json({
                mfaRequired: true,
                hasEmail: !!user.email,
                hasPhone: !!user.phoneNumber,
                userId: user._id
            });
        }

        // Determine method:
        // If they chose email, or if they don't have 2FA and registered with email primarily
        const chosenMethod = method || (user.email ? "email" : "phone");

        // Generate reset token
        const token = crypto.randomBytes(20).toString("hex");
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        if (chosenMethod === "email") {
            if (!user.email) {
                return res.status(400).json({ message: "No email address registered for this account" });
            }
            await user.save();
            const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
            const resetUrl = `${clientUrl}/reset-password/${token}`;
            await sendResetEmail(user.email, user.username, resetUrl);
            return res.json({ success: true, method: "email", message: "Password reset link successfully sent to your email" });
        } else {
            if (!user.phoneNumber) {
                return res.status(400).json({ message: "No phone number registered for this account" });
            }
            // Phone reset code: 6-digit OTP stored as resetPasswordToken
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            user.resetPasswordToken = otpCode;
            user.resetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
            await user.save();

            console.log(`[SMS RESET OTP] to ${user.phoneNumber}: ZenChat password reset code is ${otpCode}`);
            return res.json({ success: true, method: "phone", message: `Password reset code sent to phone number ${user.phoneNumber}` });
        }
    } catch (err) {
        console.error("[ForgotPassword] Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/forgot-password/verify-code", async (req, res) => {
    try {
        const { identifier, code, firebaseToken } = req.body;
        if (!identifier) {
            return res.status(400).json({ message: "Identifier is required" });
        }

        const input = identifier.trim();
        let user = null;
        if (input.includes("@")) {
            user = await User.findOne({ email: input.toLowerCase() });
        } else {
            user = await User.findOne({ phoneNumber: input });
        }

        if (!user) {
            return res.status(404).json({ message: "No account found with this identifier" });
        }

        let isVerified = false;

        if (firebaseToken) {
            try {
                const decoded = await verifyFirebaseIdToken(firebaseToken);
                if (decoded && decoded.phone_number) {
                    isVerified = true;
                }
            } catch (fbErr) {
                console.warn("Firebase ID Token reset verification failed:", fbErr.message);
            }
        }

        if (!isVerified) {
            if (!code) {
                return res.status(400).json({ message: "Verification code is required" });
            }
            if (!user.resetPasswordToken || user.resetPasswordToken !== code) {
                return res.status(400).json({ message: "Invalid verification code" });
            }
            if (new Date() > new Date(user.resetPasswordExpires)) {
                return res.status(400).json({ message: "Verification code has expired" });
            }
        }

        // Code is correct! Generate a new token for the reset page URL and return it
        const nextToken = crypto.randomBytes(20).toString("hex");
        user.resetPasswordToken = nextToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        res.json({ success: true, token: nextToken });
    } catch (err) {
        console.error("[VerifyResetCode] Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/reset-password/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ message: "New password is required" });
        }

        // Find user by token and verify expiration
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: "Password reset token is invalid or has expired" });
        }

        // Password Strength Enforcer (7-18 chars, at least one number)
        if (newPassword.length < 7 || newPassword.length > 18 || !/\d/.test(newPassword)) {
            return res.status(400).json({ message: "Password must be 7 to 18 characters long and contain at least one number" });
        }

        // Password Reuse Prevention (compare with active password)
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
            return res.status(400).json({ message: "New password cannot be the same as your current password. Please choose a different one." });
        }

        // Update password (mongoose pre-save hook will hash it)
        user.password = newPassword;

        // Reset password reset tokens
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;

        // CRITICAL FOR E2EE: Clean Slate trigger (wipes old key backups)
        user.publicKey = null;
        user.encryptedPrivateKey = null;
        user.encryptedPrivateKeyBackup = null;
        user.cryptoIv = null;
        user.cryptoSalt = null;

        await user.save();

        res.json({ success: true, message: "Password successfully updated! You can now log in." });
    } catch (err) {
        console.error("[ResetPassword] Error:", err);
        res.status(500).json({ 
            message: "Server error", 
            error: err.message, 
            stack: err.stack 
        });
    }
});

// @route   POST /api/auth/keys
// @desc    Register cryptographic public and encrypted private keys
// @access  Private
router.post("/keys", authMiddleware, async (req, res) => {
    try {
        const { publicKey, encryptedPrivateKey, encryptedPrivateKeyBackup, cryptoSalt } = req.body;

        if (!publicKey || !encryptedPrivateKey || !encryptedPrivateKeyBackup || !cryptoSalt) {
            return res.status(400).json({ message: "All E2EE key fields are required" });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.publicKey = publicKey;
        user.encryptedPrivateKey = encryptedPrivateKey;
        user.encryptedPrivateKeyBackup = encryptedPrivateKeyBackup;
        user.cryptoSalt = cryptoSalt;

        await user.save();

        res.json({ success: true, message: "Cryptographic keys successfully registered!" });
    } catch (err) {
        console.error("[RegisterKeys] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// @route   GET /api/auth/users/:id/public-key
// @desc    Get the E2EE public key of a user
// @access  Private
router.get("/users/:id/public-key", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await User.findById(id);

        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            publicKey: targetUser.publicKey
        });
    } catch (err) {
        console.error("[GetPublicKey] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// @route   POST /api/auth/users/public-keys
// @desc    Get E2EE public keys for multiple users in bulk
// @access  Private
router.post("/users/public-keys", authMiddleware, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds)) {
            return res.status(400).json({ message: "userIds array is required" });
        }
        const users = await User.find({ _id: { $in: userIds } }, "_id publicKey");
        const keysMap = {};
        users.forEach(u => {
            if (u.publicKey) {
                keysMap[u._id.toString()] = u.publicKey;
            }
        });
        res.json({ publicKeys: keysMap });
    } catch (err) {
        console.error("[GetPublicKeysBulk] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// @route   PUT /api/auth/keys-backup
// @desc    Update E2EE private key backup using a rotated recovery key
// @access  Private
router.put("/keys-backup", authMiddleware, async (req, res) => {
    try {
        const { encryptedPrivateKeyBackup } = req.body;

        if (!encryptedPrivateKeyBackup) {
            return res.status(400).json({ message: "encryptedPrivateKeyBackup is required" });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.encryptedPrivateKeyBackup = encryptedPrivateKeyBackup;
        await user.save();

        res.json({ success: true, message: "E2EE private key backup successfully updated!" });
    } catch (err) {
        console.error("[UpdateKeysBackup] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// @route   POST /api/auth/presence
// @desc    Update active user presence (survives tab suspension/minimization)
// @access  Private
router.post("/presence", authMiddleware, async (req, res) => {
    try {
        const { isActive } = req.body;
        const io = req.app.get("io");
        const { setUserActivePresence } = require("../socket/handlers");
        
        if (io) {
            await setUserActivePresence(io, req.user._id.toString(), isActive);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("[Presence] Error updating presence:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});
// @route   PUT /api/auth/purge-notice
// @desc    Acknowledge the 21-day auto-purge notice
// @access  Private
router.put("/purge-notice", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.hasSeenPurgeNotice = true;
        await user.save();
        
        res.json({ success: true, message: "Purge notice acknowledged" });
    } catch (err) {
        console.error("[PurgeNotice] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});
// @route   PUT /api/auth/theme
// @desc    Update user selected theme with server-side validation
// @access  Private
router.put("/theme", authMiddleware, async (req, res) => {
    try {
        const { theme } = req.body;
        const validThemes = ["default", "zen_oled", "earthy_calm"];
        if (!validThemes.includes(theme)) {
            return res.status(400).json({ message: "Invalid theme selection" });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Logic to check if user meets criteria for premium themes
        const canUnlockThemes = () => {
            if (user.role === "master_admin" || user.role === "co_admin") return true;
            if (!user.notificationsEnabled) return false;
            const streak = user.pulseStreak?.current || 0;
            const referrals = user.referralStats?.registrations || 0;
            return streak >= 7 || referrals >= 1;
        };

        if (theme !== "default" && !canUnlockThemes()) {
            return res.status(403).json({ message: "You have not met the criteria to unlock exclusive themes yet." });
        }

        user.selectedTheme = theme;
        await user.save();
        
        const populatedUser = await User.findById(user._id)
            .populate("blockedUsers.userId", "username avatar")
            .populate("contacts.userId", "username avatar fullName");
            
        res.json({ success: true, user: populatedUser.toPrivateJSON() });
    } catch (err) {
        console.error("[ThemeUpdate] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;