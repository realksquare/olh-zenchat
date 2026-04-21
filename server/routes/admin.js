const express = require("express");
const User = require("../models/User");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Middleware to check for co_admin or master_admin
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

// Get admin stats
router.get("/stats", authMiddleware, adminCheck, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalChats = 0; // Placeholder until Chat model count is added if needed
        const messagesCount = await Message.countDocuments();
        
        // DAU: users who were online or had lastSeen today
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

// Get all users
router.get("/users", authMiddleware, adminCheck, async (req, res) => {
    try {
        const users = await User.find({}, "-password").sort({ createdAt: -1 });
        res.json({ users });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Toggle Verification
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

// Toggle Role (Promote/Demote)
router.post("/role/:userId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const { role } = req.body;
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // Master admin check
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

// Toggle Suspension
router.post("/suspend/:userId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        if (targetUser.username === "admin_krish") {
            return res.status(403).json({ message: "Cannot suspend master admin" });
        }

        targetUser.isSuspended = !targetUser.isSuspended;
        await targetUser.save();
        res.json({ user: targetUser.toPublicJSON() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Delete User
router.delete("/users/:userId", authMiddleware, adminCheck, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        if (targetUser.username === "admin_krish") {
            return res.status(403).json({ message: "Cannot delete master admin" });
        }

        await User.findByIdAndDelete(req.params.userId);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
