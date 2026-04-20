const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");
const mongoose = require("mongoose");
const { sendPushNotification } = require("../utils/firebase");

const onlineUsers = new Map();
const disconnectTimeouts = new Map(); // For 30s grace period

const registerSocketHandlers = (io) => {
    io.on("connection", (socket) => {
        const { userId, deviceType } = socket.handshake.auth;

        if (userId) {
            // Cancel pending offline timer on reconnect
            if (disconnectTimeouts.has(userId)) {
                clearTimeout(disconnectTimeouts.get(userId));
                disconnectTimeouts.delete(userId);
            }

            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, { sockets: new Map(), hasPWA: false });
            }
            const userData = onlineUsers.get(userId);
            userData.sockets.set(socket.id, deviceType || "browser");
            userData.hasPWA = Array.from(userData.sockets.values()).includes("pwa");

            const isFirstConnection = userData.sockets.size === 1;

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
                            if (senderSockets && senderSockets.sockets) {
                                senderSockets.sockets.forEach((dType, socketId) => {
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

        socket.on("send_message", async ({ chatId, content, type, mediaUrl, replyTo, isViewOnce }) => {
            try {
                const message = await Message.create({
                    chatId,
                    senderId: userId,
                    content,
                    type: type || "text",
                    mediaUrl: mediaUrl || "",
                    replyTo: replyTo || null,
                    isViewOnce: isViewOnce || false,
                    status: "sent",
                });

                await Chat.findByIdAndUpdate(chatId, {
                    lastMessage: message._id,
                    updatedAt: new Date(),
                    deletedBy: [], 
                });

                const populated = await Message.findById(message._id)
                    .populate("senderId", "username avatar")
                    .populate("replyTo");

                const messagePayload = {
                    ...populated.toObject(),
                    chatId: chatId.toString(),
                };

                io.to(chatId).emit("receive_message", { message: messagePayload });
                
                // Extra assurance: emit to sender's current socket
                socket.emit("receive_message", { message: messagePayload });

                const chat = await Chat.findById(chatId);
                const otherParticipants = chat.participants.filter(
                    (p) => {
                        const pid = p._id?.toString() || p.toString();
                        return pid !== userId?.toString();
                    }
                );

                let isDelivered = false;
                otherParticipants.forEach((participantId) => {
                    const userData = onlineUsers.get(participantId.toString());
                    const participantSockets = userData?.sockets;

                    if (participantSockets && participantSockets.size > 0) {
                        participantSockets.forEach((dType, socketId) => {
                            const room = io.sockets.adapter.rooms.get(chatId);
                            const isInRoom = room?.has(socketId);
                            if (!isInRoom) {
                                io.to(socketId).emit("receive_message", { message: messagePayload });
                            }
                        });
                        isDelivered = true;
                    } else {
                        // User is offline: Try Push Notification
                        const pIdStr = participantId._id?.toString() || participantId.toString();
                        console.log(`[Push] User ${pIdStr} is offline, checking for push...`);
                        
                        User.findById(pIdStr).then(async (offlineUser) => {
                            if (!offlineUser) {
                                console.warn(`[Push] User ${pIdStr} not found in DB.`);
                                return;
                            }
                            
                            if (!offlineUser.notificationsEnabled) {
                                console.log(`[Push] User ${pIdStr} has notifications DISABLED.`);
                                return;
                            }

                            const tokens = offlineUser.fcmTokens || [];
                            if (tokens.length === 0 && !offlineUser.fcmToken) {
                                console.log(`[Push] User ${pIdStr} has NO valid FCM tokens.`);
                                return;
                            }

                            const senderName = populated.senderId.username;
                            const senderIsContact = offlineUser.contacts?.some(
                                c => c.userId?.toString() === userId?.toString()
                            );
                            const unreadCount = await Message.countDocuments({
                                chatId,
                                senderId: userId,
                                status: { $ne: "read" }
                            });

                            const notifSenderName = senderIsContact ? `${senderName} ✨` : senderName;
                            const title = "ZenChat";
                            let body = `New message from ${notifSenderName}!`;
                            if (unreadCount === 1) body = `1 new message from ${notifSenderName}!`;
                            else if (unreadCount > 1) body = `${unreadCount} new messages and media from ${notifSenderName}!`;

                            const pwaTokens = tokens.filter(t => t.deviceType === 'pwa');
                            const browserTokens = tokens.filter(t => t.deviceType === 'browser');
                            
                            let targetTokens = [];
                            if (pwaTokens.length > 0) {
                                targetTokens = pwaTokens.map(t => t.token);
                            } else if (browserTokens.length > 0) {
                                targetTokens = browserTokens.map(t => t.token);
                            } else if (offlineUser.fcmToken) {
                                targetTokens = [offlineUser.fcmToken];
                            }

                            console.log(`[Push] Sending to ${targetTokens.length} tokens for user ${pIdStr}...`);
                            let pushSuccess = false;
                            for (const tkn of targetTokens) {
                                const success = await sendPushNotification(offlineUser._id, tkn, title, body, {
                                    chatId: chatId.toString(),
                                    type: 'new_message',
                                    isViewOnce: messagePayload.isViewOnce ? "true" : "false"
                                });
                                if (success) pushSuccess = true;
                            }

                            if (pushSuccess) {
                                await Message.findByIdAndUpdate(message._id, { status: "delivered" });
                                const senderData = onlineUsers.get(userId);
                                if (senderData && senderData.sockets) {
                                    senderData.sockets.forEach((dType, sId) => {
                                        io.to(sId).emit("message_delivered", { chatId: chatId.toString(), messageId: message._id.toString() });
                                    });
                                }
                            }
                        }).catch(err => console.error(`[Push] Error in handlers:`, err));
                    }
                });

                if (isDelivered) {
                    await Message.findByIdAndUpdate(message._id, { status: "delivered" });
                    const senderData = onlineUsers.get(userId);
                    if (senderData && senderData.sockets) {
                        senderData.sockets.forEach((dType, sId) => {
                            io.to(sId).emit("message_delivered", { chatId: chatId.toString(), messageId: message._id.toString() });
                        });
                    }
                }

                const myData = onlineUsers.get(userId);
                if (myData && myData.sockets) {
                    myData.sockets.forEach((dType, socketId) => {
                        if (socketId !== socket.id) {
                            io.to(socketId).emit("receive_message", { message: messagePayload });
                        }
                    });
                }

                if (deliveredToAtLeastOne) {
                    if (myData && myData.sockets) {
                        myData.sockets.forEach((dType, socketId) => {
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
                
                const updated = await Message.findByIdAndUpdate(
                    messageId,
                    { content: newContent.trim(), isEdited: true, editedAt: new Date() },
                    { new: true }
                ).populate("senderId", "username avatar").populate("replyTo");

                const editPayload = { ...updated.toObject(), chatId: chatId.toString() };
                io.to(chatId).emit("message_edited", { message: editPayload });

                const chat = await Chat.findById(chatId);
                chat.participants.filter(p => p.toString() !== userId).forEach(participantId => {
                    const userData = onlineUsers.get(participantId.toString());
                    if (userData && userData.sockets) {
                        userData.sockets.forEach((dType, socketId) => {
                            const room = io.sockets.adapter.rooms.get(chatId);
                            if (!room?.has(socketId)) {
                                io.to(socketId).emit("message_edited", { message: editPayload });
                            }
                        });
                    }
                });
                
                const myData = onlineUsers.get(userId);
                if (myData && myData.sockets) {
                    myData.sockets.forEach((dType, socketId) => {
                        if (socketId !== socket.id) io.to(socketId).emit("message_edited", { message: editPayload });
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
                    await Message.findByIdAndUpdate(messageId, { deletedForEveryone: true, content: "", mediaUrl: "" });
                    io.to(chatId).emit("message_deleted", { messageId: messageId.toString(), chatId: chatId.toString(), deleteFor: "everyone" });
                    
                    const chat = await Chat.findById(chatId);
                    chat.participants.filter(p => p.toString() !== userId).forEach(participantId => {
                        const userData = onlineUsers.get(participantId.toString());
                        if (userData && userData.sockets) {
                            userData.sockets.forEach((dType, socketId) => {
                                const room = io.sockets.adapter.rooms.get(chatId);
                                if (!room?.has(socketId)) io.to(socketId).emit("message_deleted", { messageId: messageId.toString(), chatId: chatId.toString(), deleteFor: "everyone" });
                            });
                        }
                    });

                    const myData = onlineUsers.get(userId);
                    if (myData && myData.sockets) {
                        myData.sockets.forEach((dType, socketId) => {
                            if (socketId !== socket.id) io.to(socketId).emit("message_deleted", { messageId: messageId.toString(), chatId: chatId.toString(), deleteFor: "everyone" });
                        });
                    }
                } else {
                    await Message.findByIdAndUpdate(messageId, { $addToSet: { deletedFor: userId } });
                    socket.emit("message_deleted", { messageId: messageId.toString(), chatId: chatId.toString(), deleteFor: "self" });
                }
            } catch (err) {
                socket.emit("message_error", { error: "Failed to delete message" });
            }
        });

        socket.on("typing_start", async ({ chatId }) => {
            const chat = await Chat.findById(chatId);
            if (!chat) return;
            chat.participants.forEach(pId => {
                const pIdStr = pId.toString();
                if (pIdStr !== userId) {
                    io.to(pIdStr).emit("typing_status", { userId, chatId, isTyping: true });
                }
            });
        });

        socket.on("typing_stop", async ({ chatId }) => {
            const chat = await Chat.findById(chatId);
            if (!chat) return;
            chat.participants.forEach(pId => {
                const pIdStr = pId.toString();
                if (pIdStr !== userId) {
                    io.to(pIdStr).emit("typing_status", { userId, chatId, isTyping: false });
                }
            });
        });

        socket.on("message_read", async ({ chatId }) => {
            try {
                const senderIdCriteria = { $ne: new mongoose.Types.ObjectId(userId) };
                const chatIdCriteria = new mongoose.Types.ObjectId(chatId);

                const result = await Message.updateMany(
                    { chatId: chatIdCriteria, senderId: senderIdCriteria, status: { $ne: "read" } },
                    { status: "read" }
                );

                const chat = await Chat.findById(chatId);
                if (!chat) return;

                chat.participants
                    .filter(p => p.toString() !== userId)
                    .forEach(participantId => {
                        const userData = onlineUsers.get(participantId.toString());
                        if (userData && userData.sockets) {
                            userData.sockets.forEach((dType, socketId) => {
                                io.to(socketId).emit("messages_read", { chatId: chatId.toString(), readBy: userId });
                            });
                        }
                    });

                const myData = onlineUsers.get(userId);
                if (myData && myData.sockets) {
                    myData.sockets.forEach((dType, socketId) => {
                        if (socketId !== socket.id) {
                            io.to(socketId).emit("messages_read", { chatId: chatId.toString(), readBy: userId });
                        }
                    });
                }
            } catch (err) {
                console.error("[DEBUG] message_read error:", err);
                socket.emit("message_error", { error: "Failed to update read status" });
            }
        });

        socket.on("disconnect", async () => {
            if (userId) {
                const userData = onlineUsers.get(userId);
                if (userData) {
                    userData.sockets.delete(socket.id);
                    userData.hasPWA = Array.from(userData.sockets.values()).includes("pwa");
                    
                    if (userData.sockets.size === 0) {
                        // Start 7s grace period
                        console.log(`[GracePeriod] User ${userId} disconnected, starting 7s timer...`);
                        const timeoutId = setTimeout(async () => {
                            const currentData = onlineUsers.get(userId);
                            if (currentData && currentData.sockets.size === 0) {
                                onlineUsers.delete(userId);
                                disconnectTimeouts.delete(userId);
                                
                                const lastSeen = new Date();
                                try {
                                    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
                                    io.emit("user_offline", { userId, lastSeen });
                                    console.log(`[GracePeriod] User ${userId} marked offline after 7s.`);
                                } catch (err) {
                                    console.error("[GracePeriod] Error marking offline:", err);
                                }
                            }
                        }, 7000);
                        
                        disconnectTimeouts.set(userId, timeoutId);
                    }
                }
            }
        });
    });
};

module.exports = registerSocketHandlers;