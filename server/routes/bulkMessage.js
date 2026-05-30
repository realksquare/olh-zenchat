const express = require("express");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// POST /api/messages/bulk/forward
// Body: { messageIds: [], targetChatIds: [], messageContents: {} }
// Max 5 messages, max 3 chats
router.post("/forward", async (req, res) => {
    try {
        const { messageIds, targetChatIds, messageContents = {} } = req.body;
        if (!Array.isArray(messageIds) || !Array.isArray(targetChatIds)) {
            return res.status(400).json({ message: "messageIds and targetChatIds must be arrays" });
        }
        if (messageIds.length === 0 || messageIds.length > 5) {
            return res.status(400).json({ message: "Forward between 1 and 5 messages at a time" });
        }
        if (targetChatIds.length === 0 || targetChatIds.length > 3) {
            return res.status(400).json({ message: "Forward to between 1 and 3 chats at a time" });
        }

        // Validate that user is participant of all target chats
        const targetChats = await Chat.find({
            _id: { $in: targetChatIds },
            participants: req.user._id
        });
        if (targetChats.length !== targetChatIds.length) {
            return res.status(403).json({ message: "Access denied to one or more target chats" });
        }

        // Fetch the original messages (for type/mediaUrl fallback)
        const originals = await Message.find({ _id: { $in: messageIds } })
            .populate("senderId", "username avatar");

        const io = req.app.get("io");
        const createdMessages = [];

        for (const chat of targetChats) {
            for (const orig of originals) {
                // Prefer client-provided plaintext content to avoid E2EE hash passthrough
                const clientData = messageContents[orig._id.toString()] || {};
                const content = clientData.content !== undefined ? clientData.content : (orig.content || "");
                const type = clientData.type || orig.type || "text";
                const mediaUrl = clientData.mediaUrl !== undefined ? clientData.mediaUrl : (orig.mediaUrl || "");

                const newMsg = await Message.create({
                    chatId: chat._id,
                    senderId: req.user._id,
                    content,
                    type,
                    mediaUrl,
                    isForwarded: true,
                    disappearingMode: chat.disappearingMode || "off",
                });

                await Chat.findByIdAndUpdate(chat._id, {
                    lastMessage: newMsg._id,
                    updatedAt: new Date(),
                });

                const populated = await Message.findById(newMsg._id)
                    .populate("senderId", "username avatar");

                createdMessages.push(populated);

                if (io) {
                    io.to(chat._id.toString()).emit("receive_message", { message: populated });
                }
            }
        }

        res.status(201).json({ success: true, count: createdMessages.length });
    } catch (err) {
        console.error("[Bulk Forward]", err);
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/messages/bulk/delete
// Body: { messageIds: [], deleteFor: "me" | "everyone", chatId }
router.post("/delete", async (req, res) => {
    try {
        const { messageIds, deleteFor, chatId } = req.body;
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: "messageIds required" });
        }

        const chat = await Chat.findOne({ _id: chatId, participants: req.user._id });
        if (!chat) return res.status(403).json({ message: "Access denied" });

        const io = req.app.get("io");

        for (const messageId of messageIds) {
            const message = await Message.findById(messageId);
            if (!message || message.chatId.toString() !== chatId) continue;

            if (deleteFor === "everyone") {
                // Only allow delete for everyone if user is the sender
                if (message.senderId.toString() !== req.user._id.toString()) continue;
                await Message.findByIdAndUpdate(messageId, {
                    deletedForEveryone: true,
                    content: "",
                    mediaUrl: ""
                });
                if (io) {
                    io.to(chatId).emit("message_deleted", {
                        messageId,
                        chatId,
                        deleteFor: "everyone"
                    });
                }
            } else {
                // Delete for self only
                await Message.findByIdAndUpdate(messageId, {
                    $addToSet: { deletedFor: req.user._id }
                });
                if (io) {
                    io.to(req.user._id.toString()).emit("message_deleted", {
                        messageId,
                        chatId,
                        deleteFor: "self"
                    });
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[Bulk Delete]", err);
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/messages/bulk/star
// Body: { messageIds: [] }
router.post("/star", async (req, res) => {
    try {
        const { messageIds } = req.body;
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: "messageIds required" });
        }

        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { starredBy: req.user._id } }
        );

        // Also extract any GIF/sticker URLs from the messages and add to user's favoriteMedia
        const messages = await Message.find({
            _id: { $in: messageIds },
            type: { $in: ["gif", "sticker"] },
            mediaUrl: { $ne: "" }
        });

        if (messages.length > 0) {
            const user = await User.findById(req.user._id);
            const existingFavUrls = new Set((user.favoriteMedia || []).map(m => m.url));

            const newFavs = messages
                .filter(m => !existingFavUrls.has(m.mediaUrl))
                .map(m => ({ url: m.mediaUrl, mediaType: m.type }));

            if (newFavs.length > 0) {
                await User.findByIdAndUpdate(req.user._id, {
                    $push: { favoriteMedia: { $each: newFavs } }
                });
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[Bulk Star]", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
