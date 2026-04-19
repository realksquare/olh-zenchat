const express = require("express");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

router.get("/:chatId", async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.chatId,
            participants: req.user._id,
        });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        const messages = await Message.find({
            chatId: req.params.chatId,
            deletedFor: { $nin: [req.user._id] },
        })
            .populate("senderId", "username avatar")
            .populate("replyTo")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({ messages: messages.reverse() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:chatId", async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.chatId,
            participants: req.user._id,
        });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        const { content, type, mediaUrl, replyTo } = req.body;

        if (!content && !mediaUrl) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        const message = await Message.create({
            chatId: req.params.chatId,
            senderId: req.user._id,
            content,
            type: type || "text",
            mediaUrl: mediaUrl || "",
            replyTo: replyTo || null,
        });

        await Chat.findByIdAndUpdate(req.params.chatId, {
            lastMessage: message._id,
            updatedAt: new Date(),
        });

        const populated = await Message.findById(message._id)
            .populate("senderId", "username avatar")
            .populate("replyTo");

        res.status(201).json({ message: populated });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.patch("/:chatId/read", async (req, res) => {
    try {
        await Message.updateMany(
            {
                chatId: req.params.chatId,
                senderId: { $ne: req.user._id },
                status: { $ne: "read" },
            },
            { status: "read" }
        );

        res.json({ message: "Messages marked as read" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/:messageId", async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.deletedFor.includes(req.user._id)) {
            return res.status(400).json({ message: "Already deleted" });
        }

        await Message.findByIdAndUpdate(req.params.messageId, {
            $push: { deletedFor: req.user._id },
        });

        res.json({ message: "Message deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;