const express = require("express");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const authMiddleware = require("../middleware/auth");
const { uploadMedia, cloudinary } = require("../utils/cloudinary");

const router = express.Router();


router.get("/sign-upload", (req, res) => {
    try {
        const { cloudinary } = require("../utils/cloudinary");
        const timestamp = Math.round(new Date().getTime() / 1000);
        const signature = cloudinary.utils.api_sign_request(
            {
                timestamp: timestamp,
            },
            (process.env.CLOUDINARY_API_SECRET || "").trim()
        );
        res.json({
            signature,
            timestamp,
            cloudName: (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
            apiKey: (process.env.CLOUDINARY_API_KEY || "").trim(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

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
            .populate("senderId", "username avatar createdAt")
            .populate("replyTo")
            .populate("replyToMoment")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Mark as read and notify sender
        const unreadCount = await Message.countDocuments({
            chatId: req.params.chatId,
            senderId: { $ne: req.user._id },
            status: { $ne: "read" }
        });

        if (unreadCount > 0) {
            const updatePipeline = [
                {
                    $set: {
                        status: "read",
                        expiresAt: {
                            $cond: {
                                if: { $and: [{ $ne: ["$disappearingMode", "off"] }, { $eq: ["$expiresAt", null] }] },
                                then: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$disappearingMode", "instant"] }, then: { $add: ["$$NOW", 2 * 60 * 1000] } },
                                            { case: { $eq: ["$disappearingMode", "1h"] }, then: { $add: ["$$NOW", 60 * 60 * 1000] } },
                                            { case: { $eq: ["$disappearingMode", "8h"] }, then: { $add: ["$$NOW", 8 * 60 * 60 * 1000] } },
                                            { case: { $eq: ["$disappearingMode", "24h"] }, then: { $add: ["$$NOW", 24 * 60 * 60 * 1000] } },
                                            { case: { $eq: ["$disappearingMode", "7d"] }, then: { $add: ["$$NOW", 7 * 24 * 60 * 60 * 1000] } }
                                        ],
                                        default: "$expiresAt"
                                    }
                                },
                                else: "$expiresAt"
                            }
                        }
                    }
                }
            ];

            await Message.updateMany(
                { 
                    chatId: req.params.chatId, 
                    senderId: { $ne: req.user._id }, 
                    status: { $ne: "read" } 
                },
                updatePipeline
            );

            const io = req.app.get("io");
            if (io) {
                // Notify other participants that messages were read
                io.to(req.params.chatId).emit("messages_read", { 
                    chatId: req.params.chatId, 
                    readBy: req.user._id 
                });
            }
        }

        const now = new Date();
        const messagesWithRead = messages.map(msg => {
            const m = msg.toObject();
            if (m.senderId && m.senderId._id && m.senderId._id.toString() !== req.user._id.toString() && m.status !== "read") {
                m.status = "read";
                if (m.disappearingMode && m.disappearingMode !== "off" && !m.expiresAt) {
                    if (m.disappearingMode === "instant") m.expiresAt = new Date(now.getTime() + 2 * 60 * 1000);
                    else if (m.disappearingMode === "1h") m.expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
                    else if (m.disappearingMode === "8h") m.expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
                    else if (m.disappearingMode === "24h") m.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    else if (m.disappearingMode === "7d") m.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                }
            }
            return m;
        });

        res.json({ messages: messagesWithRead.reverse() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:chatId/upload", (req, res, next) => {
    uploadMedia.single("file")(req, res, (err) => {
        if (err) {
            console.error("[Upload] Multer Error:", err);
            return res.status(400).json({ message: "File upload failed", error: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file provided" });
        }

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "zenchat_media",
            resource_type: "auto"
        });

        res.json({ mediaUrl: result.secure_url });
    } catch (err) {
        console.error("[Upload] Cloudinary processing failed:", err);
        res.status(500).json({ message: "Upload failed", error: err.message });
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

        const User = require("../models/User");
        if (!chat.isGroup) {
            const otherParticipantId = chat.participants.find(p => p.toString() !== req.user._id.toString());
            if (otherParticipantId) {
                const me = await User.findById(req.user._id);
                const other = await User.findById(otherParticipantId);
                const iBlockedThem = me?.blockedUsers?.some(u => u.userId.toString() === otherParticipantId.toString());
                const theyBlockedMe = other?.blockedUsers?.some(u => u.userId.toString() === req.user._id.toString());
                if (iBlockedThem || theyBlockedMe) {
                    return res.status(403).json({ message: "Cannot send message. Block active." });
                }
            }
        }

        const { content, type, mediaUrl, replyTo, isViewOnce, isZenMessage, replyToMoment, replyToMomentUsername } = req.body;

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
            replyToMoment: replyToMoment || null,
            replyToMomentUsername: replyToMomentUsername || "",
            isViewOnce: isViewOnce === true || isViewOnce === "true",
            isZenMessage: isZenMessage === true || isZenMessage === "true",
            disappearingMode: chat.disappearingMode || "off",
        });

        await Chat.findByIdAndUpdate(req.params.chatId, {
            lastMessage: message._id,
            updatedAt: new Date(),
        });

        const populated = await Message.findById(message._id)
            .populate("senderId", "username avatar")
            .populate("replyTo")
            .populate("replyToMoment");

        res.status(201).json({ message: populated });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.patch("/:chatId/read", async (req, res) => {
    try {
        const updatePipeline = [
            {
                $set: {
                    status: "read",
                    expiresAt: {
                        $cond: {
                            if: { $and: [{ $ne: ["$disappearingMode", "off"] }, { $eq: ["$expiresAt", null] }] },
                            then: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$disappearingMode", "instant"] }, then: { $add: ["$$NOW", 2 * 60 * 1000] } },
                                        { case: { $eq: ["$disappearingMode", "1h"] }, then: { $add: ["$$NOW", 60 * 60 * 1000] } },
                                        { case: { $eq: ["$disappearingMode", "8h"] }, then: { $add: ["$$NOW", 8 * 60 * 60 * 1000] } },
                                        { case: { $eq: ["$disappearingMode", "24h"] }, then: { $add: ["$$NOW", 24 * 60 * 60 * 1000] } },
                                        { case: { $eq: ["$disappearingMode", "7d"] }, then: { $add: ["$$NOW", 7 * 24 * 60 * 60 * 1000] } }
                                    ],
                                    default: "$expiresAt"
                                }
                            },
                            else: "$expiresAt"
                        }
                    }
                }
            }
        ];

        await Message.updateMany(
            {
                chatId: req.params.chatId,
                senderId: { $ne: req.user._id },
                status: { $ne: "read" },
            },
            updatePipeline
        );

        res.json({ message: "Messages marked as read" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/:chatId/instant", async (req, res) => {
    try {
        // Security: ensure user is a participant
        const chat = await Chat.findOne({
            _id: req.params.chatId,
            participants: req.user._id,
        });
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        // Delete ALL instant+read messages in this chat for BOTH sides
        const deleted = await Message.deleteMany({
            chatId: req.params.chatId,
            disappearingMode: "instant",
            status: "read",
        });

        const io = req.app.get("io");
        if (io) {
            // Emit to all participants (both sender and recipient)
            chat.participants.forEach(pid => {
                io.to(pid.toString()).emit("instant_messages_deleted", {
                    chatId: req.params.chatId,
                });
            });
        }

        res.json({ success: true, deletedCount: deleted.deletedCount });
    } catch (err) {
        console.error("[instant-delete]", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:messageId/star", async (req, res) => {
    try {
        await Message.findByIdAndUpdate(req.params.messageId, {
            $addToSet: { starredBy: req.user._id }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:messageId/unstar", async (req, res) => {
    try {
        await Message.findByIdAndUpdate(req.params.messageId, {
            $pull: { starredBy: req.user._id }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:messageId/view", async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (message && message.isViewOnce && !message.viewedBy.includes(req.user._id)) {
            // Update viewedBy
            await Message.findByIdAndUpdate(req.params.messageId, {
                $addToSet: { viewedBy: req.user._id }
            });

            // If media exists, delete it from Cloudinary and clear URL in DB
            if (message.mediaUrl) {
                try {
                    // Extract public_id from URL
                    // Example: https://res.cloudinary.com/cloudname/image/upload/v123/folder/id.jpg
                    const parts = message.mediaUrl.split('/');
                    const filenameWithExt = parts[parts.length - 1];
                    const publicId = filenameWithExt.split('.')[0];
                    const folder = parts[parts.length - 2];
                    const fullPublicId = folder === 'upload' ? publicId : `${folder}/${publicId}`;

                    await cloudinary.uploader.destroy(fullPublicId, {
                        resource_type: message.type === 'video' ? 'video' : 'image'
                    });

                    // Clear mediaUrl in DB
                    await Message.findByIdAndUpdate(req.params.messageId, {
                        mediaUrl: "",
                        content: message.content || "Media viewed"
                    });

                    // Notify both participants
                    const io = req.app.get("io");
                    if (io) {
                        io.to(message.chatId.toString()).emit("message_edited", {
                            message: { 
                                ...message.toObject(), 
                                _id: message._id.toString(),
                                chatId: message.chatId.toString(),
                                mediaUrl: "",
                                viewedBy: [...message.viewedBy, req.user._id]
                            }
                        });
                    }
                } catch (err) {
                    console.error("[ViewOnce] Deletion failed:", err);
                }
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:messageId/delivered", async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (message && message.status === "sent") {
            await Message.findByIdAndUpdate(req.params.messageId, { status: "delivered" });
            
            const io = req.app.get("io");
            if (io) {
                io.to(message.senderId.toString()).emit("message_delivered", {
                    chatId: message.chatId.toString(),
                    messageId: message._id.toString()
                });
            }
        }
        res.json({ success: true });
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