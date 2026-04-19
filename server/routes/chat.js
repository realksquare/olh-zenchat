const express = require("express");
const mongoose = require("mongoose");
const Chat = require("../models/Chat");
const User = require("../models/User");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const chats = await Chat.find({ 
            participants: req.user._id,
            deletedBy: { $ne: req.user._id }
        })
            .populate("participants", "username avatar isOnline lastSeen")
            .populate({
                path: "lastMessage",
                populate: { path: "senderId", select: "username" },
            })
            .sort({ updatedAt: -1 });

        const userObjectId = new mongoose.Types.ObjectId(req.user._id);
        const unreadAgg = await Message.aggregate([
            {
                $match: {
                    chatId: { $in: chats.map(c => c._id) },
                    senderId: { $ne: userObjectId },
                    status: { $ne: "read" },
                    deletedForEveryone: { $ne: true },
                    deletedFor: { $ne: userObjectId },
                },
            },
            { $group: { _id: "$chatId", count: { $sum: 1 } } },
        ]);

        const unreadMap = {};
        unreadAgg.forEach(u => {
            unreadMap[u._id.toString()] = u.count;
        });

        const chatsWithUnread = await Promise.all(chats.map(async (chat) => {
            let lm = chat.lastMessage;
            if (lm && (lm.deletedForEveryone || (lm.deletedFor && lm.deletedFor.includes(req.user._id)))) {
                const realLast = await Message.findOne({
                    chatId: chat._id,
                    deletedForEveryone: { $ne: true },
                    deletedFor: { $ne: req.user._id }
                }).sort({ createdAt: -1 }).populate("senderId", "username");
                lm = realLast;
            }
            return {
                ...chat.toObject(),
                lastMessage: lm,
                unreadCount: unreadMap[chat._id.toString()] || 0,
            };
        }));

        res.json({ chats: chatsWithUnread });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/", async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }

        if (userId === req.user._id.toString()) {
            return res.status(400).json({ message: "Cannot chat with yourself" });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const existingChat = await Chat.findOne({
            isGroup: false,
            participants: { $all: [req.user._id, userId] },
        })
            .populate("participants", "username avatar isOnline lastSeen")
            .populate({
                path: "lastMessage",
                populate: { path: "senderId", select: "username" },
            });

        if (existingChat) {
            return res.json({ chat: existingChat });
        }

        const newChat = await Chat.create({
            participants: [req.user._id, userId],
            isGroup: false,
        });

        const populated = await Chat.findById(newChat._id)
            .populate("participants", "username avatar isOnline lastSeen")
            .populate({
                path: "lastMessage",
                populate: { path: "senderId", select: "username" },
            });

        res.status(201).json({ chat: populated });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/users", async (req, res) => {
    try {
        const { search } = req.query;

        if (!search || search.trim().length < 2) {
            return res.status(400).json({ message: "Search query too short" });
        }

        const users = await User.find({
            _id: { $ne: req.user._id },
            username: { $regex: search.trim(), $options: "i" },
        })
            .select("username avatar isOnline lastSeen")
            .limit(10);

        res.json({ users });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/:chatId", async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.chatId,
            participants: req.user._id,
        })
            .populate("participants", "username avatar isOnline lastSeen")
            .populate({
                path: "lastMessage",
                populate: { path: "senderId", select: "username" },
            });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        res.json({ chat });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/:chatId", async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.chatId,
            participants: req.user._id,
        });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        await Chat.findByIdAndUpdate(req.params.chatId, {
            $addToSet: { deletedBy: req.user._id }
        });

        // Optionally, clear existing messages from view for this user
        await Message.updateMany(
            { chatId: req.params.chatId, deletedFor: { $ne: req.user._id } },
            { $addToSet: { deletedFor: req.user._id } }
        );

        res.json({ success: true, message: "Chat deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;