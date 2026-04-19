const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { upload } = require("../utils/cloudinary");

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

            res.status(201).json({ token, user: user.toPublicJSON() });
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

            await User.findByIdAndUpdate(user._id, { isOnline: true });
            const token = generateToken(user);

            res.json({ token, user: user.toPublicJSON() });
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
        res.json({ user: user.toPublicJSON() });
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
                user.fcmToken = fcmToken;
            }

            if (req.file && req.file.path) {
                user.avatar = req.file.path;
            }

            await user.save();
            res.json({ user: user.toPublicJSON() });
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;