const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { upload, cloudinary } = require("../utils/cloudinary");

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
        body("password").isLength({ min: 6 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { username, email, password } = req.body;

            const existingUser = await User.findOne({
                $or: [{ email }, { username }],
            });

            if (existingUser) {
                return res.status(409).json({ message: "Username or email already taken" });
            }

            const user = await User.create({ username, email, password });
            const token = generateToken(user);

            res.status(201).json({ token, user: user.toPrivateJSON() });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    }
);

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
            const token = generateToken(user);

            res.json({ token, user: user.toPrivateJSON() });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
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
        body("password").optional().isLength({ min: 6 }),
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
                console.log("[Auth] Cloudinary Config Check:", {
                    cloud_name: cloudinary.config().cloud_name,
                    api_key: cloudinary.config().api_key,
                    has_secret: !!cloudinary.config().api_secret
                });
                console.log("[Auth] Uploading avatar to Cloudinary:", req.file.path);
                try {
                    const result = await cloudinary.uploader.upload(req.file.path, {
                        folder: "zenchat_avatars",
                        resource_type: "image"
                    });
                    console.log("[Auth] Cloudinary upload success:", result.secure_url);
                    user.avatar = result.secure_url;
                } catch (cloudErr) {
                    console.error("[Auth] Cloudinary upload failed:", cloudErr);
                    throw cloudErr; // Re-throw to be caught by catch(err)
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
            res.json({ user: user.toPrivateJSON() });
        } catch (err) {
            console.error("[Auth] Update failed:", err);
            res.status(500).json({ message: "Server error", error: err.message });
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
            return res.json({ user: me.toPublicJSON() });
        }
        me.contacts.push({ userId: targetId, tag: "general" });
        await me.save();
        res.json({ user: me.toPrivateJSON() });
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
        res.json({ user: me.toPrivateJSON() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;