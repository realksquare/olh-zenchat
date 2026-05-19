const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { upload, cloudinary } = require("../utils/cloudinary");
const crypto = require("crypto");
const { sendResetEmail } = require("../utils/mailService");

const router = express.Router();

const generateToken = (user) => {
    return jwt.sign(
        { _id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

router.post(
    "/register",
    [
        body("username").trim().isLength({ min: 3, max: 20 }),
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

            await User.findByIdAndUpdate(user._id, { isOnline: true });
            const populatedUser = await User.findById(user._id).populate("blockedUsers.userId", "username avatar");
            const token = generateToken(user);

            res.json({ token, user: populatedUser.toPrivateJSON() });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate("blockedUsers.userId", "username avatar");
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
            const { username, email, password, notificationsEnabled, fcmToken } = req.body;
            const user = await User.findById(req.user._id);

            if (!user) {
                return res.status(404).json({ message: "User not found" });
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

            if (req.body.privacySettings) {
                const settings = typeof req.body.privacySettings === 'string' 
                    ? JSON.parse(req.body.privacySettings) 
                    : req.body.privacySettings;
                user.privacySettings = { ...user.privacySettings, ...settings };
            }

            await user.save();
            const populatedUser = await User.findById(user._id).populate("blockedUsers.userId", "username avatar");
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
            const populatedMe = await User.findById(me._id).populate("blockedUsers.userId", "username avatar");
            return res.json({ user: populatedMe.toPrivateJSON() });
        }
        me.contacts.push({ userId: targetId, tag: "general" });
        await me.save();
        const populatedMe = await User.findById(me._id).populate("blockedUsers.userId", "username avatar");
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
        const populatedMe = await User.findById(me._id).populate("blockedUsers.userId", "username avatar");
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

        const populatedMe = await User.findById(me._id).populate("blockedUsers.userId", "username avatar");
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

        const populatedMe = await User.findById(me._id).populate("blockedUsers.userId", "username avatar");
        res.json({ user: populatedMe.toPrivateJSON() });
    } catch (err) {
        console.error("Unblock user error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ message: "User with this email does not exist" });
        }

        // Generate secure random token
        const token = crypto.randomBytes(20).toString("hex");

        // Save to DB (expires in 1 hour)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        // Construct reset URL
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const resetUrl = `${clientUrl}/reset-password/${token}`;

        // Dispatch email
        await sendResetEmail(user.email, user.username, resetUrl);

        res.json({ success: true, message: "Reset link successfully sent to your email" });
    } catch (err) {
        console.error("[ForgotPassword] Error:", err);
        res.status(500).json({ 
            message: "Server error", 
            error: err.message, 
            stack: err.stack 
        });
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

module.exports = router;