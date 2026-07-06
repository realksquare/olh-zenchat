const express = require("express");
const mongoose = require("mongoose");
const Chat = require("../models/Chat");
const User = require("../models/User");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");
const { sanitizeChatParticipants } = require("../utils/privacyHelper");

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const chats = await Chat.find({ 
            participants: req.user._id,
            deletedBy: { $ne: req.user._id }
        })
            .populate("participants", "username fullName avatar bio isOnline lastSeen isVerified createdAt privacySettings contacts")
            .populate({
                path: "lastMessage",
                populate: { path: "senderId", select: "username" },
            });

        const sortedChats = chats.sort((a, b) => {
            const aPinned = a.pinnedBy?.includes(req.user._id);
            const bPinned = b.pinnedBy?.includes(req.user._id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

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

        const me = await User.findById(req.user._id);

        const otherUserIds = sortedChats
            .filter(c => !c.isGroup)
            .map(c => {
                const other = c.participants.find(p => p._id.toString() !== req.user._id.toString());
                return other?._id || other;
            })
            .filter(Boolean);
            
        const otherUsers = await User.find({ _id: { $in: otherUserIds } }).select("blockedUsers");
        const otherUsersMap = Object.fromEntries(otherUsers.map(u => [u._id.toString(), u]));

        const chatsWithUnread = await Promise.all(sortedChats.map(async (chat) => {
            let lm = chat.lastMessage;
            if (!lm || (lm && (lm.deletedForEveryone || (lm.deletedFor && lm.deletedFor.includes(req.user._id))))) {
                const realLast = await Message.findOne({
                    chatId: chat._id,
                    deletedForEveryone: { $ne: true },
                    deletedFor: { $ne: req.user._id }
                }).sort({ createdAt: -1 }).populate("senderId", "username");
                lm = realLast;
            }
            let blockStatus = null;
            if (!chat.isGroup) {
                const otherParticipant = chat.participants.find(p => p._id.toString() !== req.user._id.toString());
                const otherParticipantId = otherParticipant?._id || otherParticipant;
                if (otherParticipantId) {
                    const other = otherUsersMap[otherParticipantId.toString()];
                    
                    const iBlockedThem = me?.blockedUsers?.some(u => u.userId.toString() === otherParticipantId.toString());
                    const theyBlockedMe = other?.blockedUsers?.some(u => u.userId.toString() === req.user._id.toString());
                    
                    blockStatus = {
                        iBlocked: !!iBlockedThem,
                        theyBlocked: !!theyBlockedMe
                    };
                }
            }
            let rawChat = {
                ...chat.toObject(),
                lastMessage: lm,
                unreadCount: unreadMap[chat._id.toString()] || 0,
                blockStatus
            };
            return sanitizeChatParticipants(rawChat, me);
        }));

        // Filter out completely empty chats (no messages visible to the user)
        // These are ghost sessions from users who opened a chat window but never sent a message
        const nonEmptyChats = chatsWithUnread.filter(c => c.lastMessage != null);

        res.json({ chats: nonEmptyChats });
    } catch (err) {
        console.error("Fetch chats error:", err);
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

        const [me, targetUser] = await Promise.all([
            User.findById(req.user._id),
            User.findById(userId)
        ]);
        
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const existingChat = await Chat.findOne({
            isGroup: false,
            participants: { $all: [req.user._id, userId] },
        });

        if (existingChat) {
            const wasDeletedByMe = existingChat.deletedBy?.some(
                d => d.toString() === req.user._id.toString()
            );
            if (wasDeletedByMe) {
                // Restore the chat: remove current user from deletedBy, clear lastMessage
                await Chat.findByIdAndUpdate(existingChat._id, {
                    $pull: { deletedBy: req.user._id },
                    $set: { lastMessage: null }
                });
            }
            // Re-fetch fully populated (fresh data, no stale deletedBy or lastMessage)
            const freshChat = await Chat.findById(existingChat._id)
                .populate("participants", "username fullName avatar bio isOnline lastSeen isVerified privacySettings contacts")
                .populate({
                    path: "lastMessage",
                    populate: { path: "senderId", select: "username" },
                });

            let blockStatus = null;
            if (!freshChat.isGroup) {
                blockStatus = {
                    iBlocked: !!(me?.blockedUsers?.some(u => u.userId.toString() === userId.toString())),
                    theyBlocked: !!(targetUser?.blockedUsers?.some(u => u.userId.toString() === req.user._id.toString()))
                };
            }
            const freshObj = freshChat.toObject();
            freshObj.blockStatus = blockStatus;
            return res.json({ chat: sanitizeChatParticipants(freshObj, me) });
        }

        const newChat = await Chat.create({
            participants: [req.user._id, userId],
            isGroup: false,
        });

        const populated = await Chat.findById(newChat._id)
            .populate("participants", "username fullName avatar bio isOnline lastSeen isVerified createdAt privacySettings contacts")
            .populate({
                path: "lastMessage",
                populate: { path: "senderId", select: "username" },
            });

        let blockStatus = null;
        if (!populated.isGroup) {
            blockStatus = {
                iBlocked: !!(me?.blockedUsers?.some(u => u.userId.toString() === userId.toString())),
                theyBlocked: !!(targetUser?.blockedUsers?.some(u => u.userId.toString() === req.user._id.toString()))
            };
        }

        const populatedObj = populated.toObject();
        populatedObj.blockStatus = blockStatus;
        const sanitizedChat = sanitizeChatParticipants(populatedObj, me);

        const io = req.app.get("io");
        if (io) {
            io.to(userId).emit("new_chat", { chat: sanitizedChat });
        }

        res.status(201).json({ chat: sanitizedChat });
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
            .select("username avatar bio isOnline lastSeen isVerified privacySettings contacts")
            .limit(10);

        const { sanitizeUserList } = require("../utils/privacyHelper");
        const me = await User.findById(req.user._id);

        res.json({ users: sanitizeUserList(users, me) });
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
            .populate("participants", "username fullName avatar bio isOnline lastSeen isVerified createdAt privacySettings contacts")
            .populate({
                path: "lastMessage",
                populate: { path: "senderId", select: "username" },
            });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        let blockStatus = null;
        if (!chat.isGroup) {
            const otherParticipant = chat.participants.find(p => p._id.toString() !== req.user._id.toString());
            const otherParticipantId = otherParticipant?._id || otherParticipant;
            if (otherParticipantId) {
                const me = await User.findById(req.user._id);
                const other = await User.findById(otherParticipantId);
                
                const iBlockedThem = me?.blockedUsers?.some(u => u.userId.toString() === otherParticipantId.toString());
                const theyBlockedMe = other?.blockedUsers?.some(u => u.userId.toString() === req.user._id.toString());
                
                blockStatus = {
                    iBlocked: !!iBlockedThem,
                    theyBlocked: !!theyBlockedMe
                };
            }
        }

        res.json({ 
            chat: sanitizeChatParticipants({
                ...chat.toObject(),
                blockStatus
            }, await User.findById(req.user._id))
        });
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

        // Add this user to deletedBy
        const updatedChat = await Chat.findByIdAndUpdate(
            req.params.chatId,
            { $addToSet: { deletedBy: req.user._id } },
            { new: true }
        );

        // If ALL participants have deleted it, permanently remove from DB
        const allDeleted = chat.participants.every(p =>
            updatedChat.deletedBy.some(d => d.toString() === p.toString())
        );

        const io = req.app.get("io");

        if (allDeleted) {
            await Message.deleteMany({ chatId: req.params.chatId });
            await Chat.findByIdAndDelete(req.params.chatId);

            // Notify all participants
            if (io) {
                chat.participants.forEach(pid => {
                    io.to(pid.toString()).emit("chat_deleted", { chatId: req.params.chatId });
                });
            }
        } else {
            // Soft-delete messages for this user only
            await Message.updateMany(
                { chatId: req.params.chatId, deletedFor: { $ne: req.user._id } },
                { $addToSet: { deletedFor: req.user._id } }
            );

            // Emit to the current user's other devices
            if (io) {
                io.to(req.user._id.toString()).emit("chat_deleted", { chatId: req.params.chatId });
            }
        }

        res.json({ success: true, message: "Chat deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:chatId/pin", async (req, res) => {
    try {
        await Chat.findByIdAndUpdate(req.params.chatId, {
            $addToSet: { pinnedBy: req.user._id }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:chatId/unpin", async (req, res) => {
    try {
        await Chat.findByIdAndUpdate(req.params.chatId, {
            $pull: { pinnedBy: req.user._id }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.put("/:chatId/disappearing", async (req, res) => {
    try {
        const { mode } = req.body;
        const validModes = ["off", "instant", "1h", "8h", "24h", "7d"];
        
        if (!validModes.includes(mode)) {
            return res.status(400).json({ message: "Invalid disappearing mode" });
        }

        const chat = await Chat.findOne({
            _id: req.params.chatId,
            participants: req.user._id,
        });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        chat.disappearingMode = mode;
        await chat.save();

        const io = req.app.get("io");
        if (io) {
            chat.participants.forEach(pid => {
                io.to(pid.toString()).emit("chat_updated", {
                    chatId: chat._id,
                    disappearingMode: mode
                });
            });
        }

        res.json({ success: true, mode });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// REST Outbox Background Sync Fallback Endpoint
router.post("/offline-sync", async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ message: "Invalid payload, array of messages required" });
        }

        const io = req.app.get("io");
        const syncedMessages = [];

        for (const msgPayload of messages) {
            const { chatId, content, type, mediaUrl, replyTo, isViewOnce, cid, isEncrypted, encryptedSymmetricKey, iv, isLowBandwidth, isZenMessage, replyToMoment, replyToMomentUsername, lqip } = msgPayload;

            const chat = await Chat.findById(chatId).populate("participants", "fullName privacySettings contacts blockedUsers notificationsEnabled fcmTokens fcmToken");
            if (!chat) continue;

            const message = await Message.create({
                chatId,
                senderId: req.user._id,
                content,
                type: type || "text",
                mediaUrl: mediaUrl || "",
                lqip: lqip || "",
                replyTo: replyTo || null,
                replyToMoment: replyToMoment || null,
                replyToMomentUsername: replyToMomentUsername || "",
                isViewOnce: isViewOnce || false,
                cid: cid || null,
                status: "sent",
                disappearingMode: chat.disappearingMode || "off",
                isEncrypted: isEncrypted || false,
                encryptedSymmetricKey: encryptedSymmetricKey || "",
                iv: iv || "",
                isLowBandwidth: isLowBandwidth || false,
                isZenMessage: isZenMessage || false
            });

            await Chat.findByIdAndUpdate(chatId, {
                lastMessage: message._id,
                updatedAt: new Date(),
                deletedBy: [],
            });

            const populated = await Message.findById(message._id)
                .populate("senderId", "username avatar createdAt")
                .populate("replyTo")
                .populate("replyToMoment");

            const messagePayloadBase = {
                ...populated.toObject(),
                chatId: chatId.toString(),
            };

            syncedMessages.push(messagePayloadBase);

            if (io) {
                const participants = chat.participants;
                participants.forEach((participant) => {
                    const pIdStr = participant._id.toString();
                    io.to(pIdStr).emit("receive_message", { message: messagePayloadBase });
                });
            }
        }

        res.json({ success: true, count: syncedMessages.length });
    } catch (err) {
        console.error("[REST Offline Sync] Failed:", err);
        res.status(500).json({ message: "Server error during outbox sync" });
    }
});

module.exports = router;