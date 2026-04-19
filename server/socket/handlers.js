const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");
const mongoose = require("mongoose");
const { sendPushNotification } = require("../utils/firebase");

const onlineUsers = new Map();

const registerSocketHandlers = (io) => {
    io.on("connection", (socket) => {
        const userId = socket.handshake.auth.userId;

        if (userId) {
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
            }
            const isFirstConnection = onlineUsers.get(userId).size === 0;
            onlineUsers.get(userId).add(socket.id);

            if (isFirstConnection) {
                User.findByIdAndUpdate(userId, { isOnline: true }).exec();
                io.emit("user_online", { userId });
            }

            (async () => {
                try {
                    const chats = await Chat.find({ participants: userId });
                    const chatIds = chats.map((c) => c._id);

                    const pendingMessages = await Message.find({
                        chatId: { $in: chatIds },
                        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
                        status: "sent",
                    });

                    if (pendingMessages.length > 0) {
                        await Message.updateMany(
                            { _id: { $in: pendingMessages.map((m) => m._id) } },
                            { status: "delivered" }
                        );

                        pendingMessages.forEach((msg) => {
                            const senderSockets = onlineUsers.get(msg.senderId.toString());
                            if (senderSockets && senderSockets.size > 0) {
                                senderSockets.forEach(socketId => {
                                    io.to(socketId).emit("message_delivered", {
                                        messageId: msg._id.toString(),
                                        chatId: msg.chatId.toString(),
                                    });
                                });
                            }
                        });
                    }
                } catch (err) {
                    console.error("Error delivering pending messages:", err);
                }
            })();
        }

        socket.on("join_chat", ({ chatId }) => {
            socket.join(chatId);
        });

        socket.on("leave_chat", ({ chatId }) => {
            socket.leave(chatId);
        });

        socket.on("send_message", async ({ chatId, content, type, mediaUrl, replyTo }) => {
            try {
                const message = await Message.create({
                    chatId,
                    senderId: userId,
                    content,
                    type: type || "text",
                    mediaUrl: mediaUrl || "",
                    replyTo: replyTo || null,
                    status: "sent",
                });

                await Chat.findByIdAndUpdate(chatId, {
                    lastMessage: message._id,
                    updatedAt: new Date(),
                    deletedBy: [], // Re-show chat to anyone who deleted it
                });

                const populated = await Message.findById(message._id)
                    .populate("senderId", "username avatar")
                    .populate("replyTo");

                const messagePayload = {
                    ...populated.toObject(),
                    chatId: chatId.toString(),
                };

                io.to(chatId).emit("receive_message", { message: messagePayload });

                const chat = await Chat.findById(chatId);
                const otherParticipants = chat.participants.filter(
                    (p) => p.toString() !== userId
                );

                let deliveredToAtLeastOne = false;

                otherParticipants.forEach((participantId) => {
                    const participantSockets = onlineUsers.get(participantId.toString());
                    if (participantSockets && participantSockets.size > 0) {
                        participantSockets.forEach(socketId => {
                            const room = io.sockets.adapter.rooms.get(chatId);
                            const isInRoom = room?.has(socketId);

                            if (!isInRoom) {
                                io.to(socketId).emit("receive_message", { message: messagePayload });
                            }
                        });

                        Message.findByIdAndUpdate(message._id, { status: "delivered" }).exec();
                        deliveredToAtLeastOne = true;
                    } else {
                        // User is offline, send push notification
                        User.findById(participantId).then(offlineUser => {
                            if (offlineUser && offlineUser.notificationsEnabled && offlineUser.fcmToken) {
                                const senderName = populated.senderId.username;
                                const title = `New message from ${senderName}`;
                                const body = messagePayload.type === 'image' ? '📷 Image' : messagePayload.content;
                                sendPushNotification(offlineUser.fcmToken, title, body, {
                                    chatId: chatId.toString(),
                                    type: 'new_message'
                                });
                            }
                        }).catch(console.error);
                    }
                });

                // Sync the sent message back to the sender's other active devices
                const mySockets = onlineUsers.get(userId);
                if (mySockets) {
                    mySockets.forEach(socketId => {
                        if (socketId !== socket.id) {
                            io.to(socketId).emit("receive_message", { message: messagePayload });
                        }
                    });
                }

                if (deliveredToAtLeastOne) {
                    // Send to all other devices of the sender as well (for syncing)
                    const mySockets = onlineUsers.get(userId);
                    if (mySockets) {
                        mySockets.forEach(socketId => {
                            io.to(socketId).emit("message_delivered", {
                                messageId: message._id.toString(),
                                chatId: chatId.toString(),
                            });
                        });
                    }
                }
            } catch (err) {
                socket.emit("message_error", { error: "Failed to send message" });
            }
        });

        socket.on("edit_message", async ({ chatId, messageId, newContent }) => {
            try {
                const message = await Message.findById(messageId);

                if (!message || message.senderId.toString() !== userId) return;
                if (message.deletedForEveryone) return;

                const tenMinutes = 10 * 60 * 1000;
                if (Date.now() - new Date(message.createdAt).getTime() > tenMinutes) {
                    socket.emit("message_error", { error: "Edit window has expired" });
                    return;
                }

                const updated = await Message.findByIdAndUpdate(
                    messageId,
                    { content: newContent.trim(), isEdited: true, editedAt: new Date() },
                    { new: true }
                )
                    .populate("senderId", "username avatar")
                    .populate("replyTo");

                const editPayload = {
                    ...updated.toObject(),
                    chatId: chatId.toString(),
                };

                const chat = await Chat.findById(chatId);
                if (chat && chat.lastMessage?.toString() === messageId) {
                    await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });
                }

                io.to(chatId).emit("message_edited", { message: editPayload });

                const otherParticipants = chat.participants.filter(
                    (p) => p.toString() !== userId
                );

                otherParticipants.forEach((participantId) => {
                    const participantSockets = onlineUsers.get(participantId.toString());
                    if (participantSockets && participantSockets.size > 0) {
                        participantSockets.forEach(socketId => {
                            const room = io.sockets.adapter.rooms.get(chatId);
                            const isInRoom = room?.has(socketId);
                            if (!isInRoom) {
                                io.to(socketId).emit("message_edited", { message: editPayload });
                            }
                        });
                    }
                });
                
                // Sync to sender's other devices
                const mySockets = onlineUsers.get(userId);
                if (mySockets) {
                    mySockets.forEach(socketId => {
                        if (socketId !== socket.id) {
                            io.to(socketId).emit("message_edited", { message: editPayload });
                        }
                    });
                }
            } catch (err) {
                socket.emit("message_error", { error: "Failed to edit message" });
            }
        });

        socket.on("delete_message", async ({ chatId, messageId, deleteFor }) => {
            try {
                const message = await Message.findById(messageId);

                if (!message || message.senderId.toString() !== userId) return;

                if (deleteFor === "everyone") {
                    await Message.findByIdAndUpdate(messageId, {
                        deletedForEveryone: true,
                        content: "",
                        mediaUrl: "",
                    });

                    const chat = await Chat.findById(chatId);

                    if (chat && chat.lastMessage?.toString() === messageId) {
                        const prevMessage = await Message.findOne({
                            chatId,
                            _id: { $ne: messageId },
                            deletedForEveryone: false,
                        }).sort({ createdAt: -1 });

                        await Chat.findByIdAndUpdate(chatId, {
                            lastMessage: prevMessage?._id || null,
                            updatedAt: new Date(),
                        });
                    }

                    io.to(chatId).emit("message_deleted", {
                        messageId: messageId.toString(),
                        chatId: chatId.toString(),
                        deleteFor: "everyone",
                    });

                    const otherParticipants = chat.participants.filter(
                        (p) => p.toString() !== userId
                    );

                    otherParticipants.forEach((participantId) => {
                        const participantSockets = onlineUsers.get(participantId.toString());
                        if (participantSockets && participantSockets.size > 0) {
                            participantSockets.forEach(socketId => {
                                const room = io.sockets.adapter.rooms.get(chatId);
                                const isInRoom = room?.has(socketId);
                                if (!isInRoom) {
                                    io.to(socketId).emit("message_deleted", {
                                        messageId: messageId.toString(),
                                        chatId: chatId.toString(),
                                        deleteFor: "everyone",
                                    });
                                }
                            });
                        }
                    });
                    
                    // Sync to sender's other devices
                    const mySockets = onlineUsers.get(userId);
                    if (mySockets) {
                        mySockets.forEach(socketId => {
                            if (socketId !== socket.id) {
                                io.to(socketId).emit("message_deleted", {
                                    messageId: messageId.toString(),
                                    chatId: chatId.toString(),
                                    deleteFor: "everyone",
                                });
                            }
                        });
                    }
                } else {
                    await Message.findByIdAndUpdate(messageId, {
                        $addToSet: { deletedFor: userId },
                    });

                    socket.emit("message_deleted", {
                        messageId: messageId.toString(),
                        chatId: chatId.toString(),
                        deleteFor: "self",
                    });
                }
            } catch (err) {
                socket.emit("message_error", { error: "Failed to delete message" });
            }
        });

        socket.on("typing_start", ({ chatId }) => {
            socket.to(chatId).emit("typing_status", { userId, chatId, isTyping: true });
        });

        socket.on("typing_stop", ({ chatId }) => {
            socket.to(chatId).emit("typing_status", { userId, chatId, isTyping: false });
        });

        socket.on("message_read", async ({ chatId }) => {
            try {
                await Message.updateMany(
                    {
                        chatId: new mongoose.Types.ObjectId(chatId),
                        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
                        status: { $ne: "read" },
                    },
                    { status: "read" }
                );

                const chat = await Chat.findById(chatId);
                const otherParticipants = chat.participants.filter(
                    (p) => p.toString() !== userId
                );

                otherParticipants.forEach((participantId) => {
                    const participantSockets = onlineUsers.get(participantId.toString());
                    if (participantSockets && participantSockets.size > 0) {
                        participantSockets.forEach(socketId => {
                            io.to(socketId).emit("messages_read", {
                                chatId: chatId.toString(),
                                readBy: userId,
                            });
                        });
                    }
                });
            } catch (err) {
                socket.emit("message_error", { error: "Failed to update read status" });
            }
        });

        socket.on("disconnect", async () => {
            if (userId) {
                const userSockets = onlineUsers.get(userId);
                if (userSockets) {
                    userSockets.delete(socket.id);
                    if (userSockets.size === 0) {
                        onlineUsers.delete(userId);
                        const lastSeen = new Date();
                        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
                        io.emit("user_offline", { userId, lastSeen });
                    }
                }
            }
        });
    });
};

module.exports = registerSocketHandlers;