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

        res.json({ user: targetUser.toPublicJSON() });
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

        // Find all users who have at least one fcm token
        const users = await User.find({ "fcmTokens.0": { $exists: true } });
        const promises = [];
        
        for (const u of users) {
            for (const t of u.fcmTokens) {
                if (t.token) {
                    promises.push(
                        sendPushNotification(u._id, t.token, title, body)
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

module.exports = router;
