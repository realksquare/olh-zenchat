const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");
const mongoose = require("mongoose");
const { sendPushNotification } = require("../utils/firebase");

const onlineUsers = new Map();
const disconnectTimeouts = new Map();

const registerSocketHandlers = (io) => {
    io.on("connection", (socket) => {
        const { userId, deviceType } = socket.handshake.auth;

        if (userId) {
            socket.join(userId);
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

            const broadcastUserStatus = async (uid, isOnline, lastSeen = null) => {
                try {
                    const user = await User.findById(uid).select("privacySettings contacts");
                    if (!user) return;

                    const privacy = user.privacySettings?.onlineStatus || "everyone";

                    for (const [targetId, targetData] of onlineUsers.entries()) {
                        if (targetId === uid) continue;

                        let canSee = false;
                        if (privacy === "everyone") {
                            canSee = true;
                        } else if (privacy === "nobody") {
                            canSee = false;
                        } else {
                            const isContact = user.contacts?.some(c =>
                                c.userId.toString() === targetId &&
                                (privacy === "contacts" || c.tag === privacy)
                            );
                            if (isContact) canSee = true;
                        }

                        if (canSee) {
                            targetData.sockets.forEach((dType, sId) => {
                                if (isOnline) {
                                    io.to(sId).emit("user_online", { userId: uid });
                                } else {
                                    io.to(sId).emit("user_offline", { userId: uid, lastSeen });
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error broadcasting status:", err);
                }
            };

            if (userData.sockets.size === 1) {
                User.findByIdAndUpdate(userId, { isOnline: true }).exec();
                broadcastUserStatus(userId, true);
            }

            socket.on("disconnect", () => {
                if (userData && userData.sockets.has(socket.id)) {
                    userData.sockets.delete(socket.id);
                    userData.hasPWA = Array.from(userData.sockets.values()).includes("pwa");

                    if (userData.sockets.size === 0) {
                        const timeout = setTimeout(async () => {
                            const now = new Date();
                            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: now });
                            onlineUsers.delete(userId);
                            disconnectTimeouts.delete(userId);
                            broadcastUserStatus(userId, false, now);
                        }, 30000);
                        disconnectTimeouts.set(userId, timeout);
                    }
                }
            });

            (async () => {
                try {
                    const chats = await Chat.find({ participants: userId });
                    const chatIds = chats.map((c) => c._id);

                    const pendingMessages = await Message.find({
                        chatId: { $in: chatIds },
                        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
                        status: { $in: ["sent", "delivered"] },
                    }).populate("senderId", "username avatar createdAt").populate("replyTo");

                    if (pendingMessages.length > 0) {
                        await Message.updateMany(
                            { _id: { $in: pendingMessages.map((m) => m._id) } },
                            { status: "delivered" }
                        );

                        // Push missed messages directly to the newly-connected recipient
                        // This ensures offline messages render immediately without waiting for fetchMessages REST call
                        pendingMessages.forEach((msg) => {
                            socket.emit("receive_message", {
                                message: { ...msg.toObject(), chatId: msg.chatId.toString() }
                            });
                        });

                        // Notify senders their messages were delivered
                        pendingMessages.forEach((msg) => {
                            const senderSockets = onlineUsers.get(msg.senderId._id?.toString() || msg.senderId.toString());
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

                    for (const [otherId, otherData] of onlineUsers.entries()) {
                        if (otherId === userId) continue;

                        const otherUser = await User.findById(otherId).select("privacySettings contacts");
                        if (!otherUser) continue;

                        const privacy = otherUser.privacySettings?.onlineStatus || "everyone";
                        let canSee = false;

                        if (privacy === "everyone") {
                            canSee = true;
                        } else if (privacy === "nobody") {
                            canSee = false;
                        } else {
                            const isContact = otherUser.contacts?.some(c =>
                                c.userId.toString() === userId &&
                                (privacy === "contacts" || c.tag === privacy)
                            );
                            if (isContact) canSee = true;
                        }

                        if (canSee) {
                            socket.emit("user_online", { userId: otherId });
                        }
                    }

                } catch (err) {
                    console.error("Error in connection async block:", err);
                }
            })();
        }

        socket.on("join_chat", ({ chatId }) => {
            socket.join(chatId);
        });

        socket.on("leave_chat", ({ chatId }) => {
            socket.leave(chatId);
        });

        socket.on("send_message", async ({ chatId, content, type, mediaUrl, replyTo, isViewOnce, cid }) => {
            try {
                const message = await Message.create({
                    chatId,
                    senderId: userId,
                    content,
                    type: type || "text",
                    mediaUrl: mediaUrl || "",
                    replyTo: replyTo || null,
                    isViewOnce: isViewOnce || false,
                    cid: cid || null,
                    status: "sent",
                });

                await Chat.findByIdAndUpdate(chatId, {
                    lastMessage: message._id,
                    updatedAt: new Date(),
                    deletedBy: [],
                });

                const populated = await Message.findById(message._id)
                    .populate("senderId", "username avatar createdAt")
                    .populate("replyTo");

                const sender = await User.findById(userId).select("privacySettings contacts");
                const typingPrivacy = sender.privacySettings?.typingIndicator || "everyone";

                const messagePayloadBase = {
                    ...populated.toObject(),
                    chatId: chatId.toString(),
                };

                const chat = await Chat.findById(chatId).populate("participants", "privacySettings contacts");
                const participants = chat.participants;

                const allows = (userA, userBId, privacy) => {
                    if (privacy === "everyone") return true;
                    if (privacy === "nobody") return false;
                    return userA.contacts?.some(c => c.userId.toString() === userBId);
                };

                participants.forEach(async (participant) => {
                    const pIdStr = participant._id.toString();

                    const recipientPrivacy = participant.privacySettings?.typingIndicator || "everyone";
                    const senderAllowsRecipient = allows(sender, pIdStr, typingPrivacy);
                    const recipientAllowsSender = allows(participant, userId, recipientPrivacy);

                    const canSeeScramble = senderAllowsRecipient && recipientAllowsSender;

                    const messagePayload = { ...messagePayloadBase, canSeeScramble };

                    const userData = onlineUsers.get(pIdStr);
                    if (userData && userData.sockets && userData.sockets.size > 0) {
                        console.log(`[Socket] Emitting receive_message to user ${pIdStr} (${userData.sockets.size} sockets)`);
                        userData.sockets.forEach((dType, socketId) => {
                            if (pIdStr === userId.toString()) {
                                io.to(socketId).emit("receive_message", { message: messagePayloadBase });
                            } else {
                                io.to(socketId).emit("receive_message", { message: messagePayload });
                            }
                        });
                    } else {
                        console.log(`[Socket] User ${pIdStr} has no active sockets. Skipping emission.`);
                    }
                });

                let isDelivered = false;
                const otherParticipants = participants.filter(p => (p._id?.toString() || p.toString()) !== userId.toString());
                otherParticipants.forEach((participant) => {
                    const pIdStr = participant._id?.toString() || participant.toString();
                    const userData = onlineUsers.get(pIdStr);
                    if (userData && userData.sockets && userData.sockets.size > 0) {
                        isDelivered = true;
                    } else {
                        console.log(`[Push] User ${pIdStr} is offline. Starting notification flow...`);

                        User.findById(pIdStr).then(async (offlineUser) => {
                            if (!offlineUser) {
                                console.log(`[Push] Error: User ${pIdStr} not found in DB.`);
                                return;
                            }
                            if (!offlineUser.notificationsEnabled) {
                                console.log(`[Push] Info: Notifications disabled for user ${pIdStr}.`);
                                return;
                            }

                            const tokens = offlineUser.fcmTokens || [];
                            console.log(`[Push] Token Verify: User ${pIdStr} has ${tokens.length} tokens and ${offlineUser.fcmToken ? '1 legacy token' : 'no legacy token'}.`);

                            if (tokens.length === 0 && !offlineUser.fcmToken) {
                                console.log(`[Push] Skip: No tokens found for user ${pIdStr}.`);
                                return;
                            }

                            const senderName = populated.senderId.username;
                            const senderIsContact = offlineUser.contacts?.some(
                                c => c.userId?.toString() === userId?.toString()
                            );
                            const unreadMessages = await Message.find({
                                chatId,
                                senderId: userId,
                                status: { $ne: "read" }
                            });

                            const unreadCount = unreadMessages.length;
                            const hasMedia = unreadMessages.some(m => m.type === 'image' || m.type === 'video');
                            const hasText = unreadMessages.some(m => m.type === 'text');

                            const notifSenderName = senderIsContact ? `${senderName} ✨` : senderName;
                            const title = "ZenChat";
                            let body = `New message from ${notifSenderName}!`;

                            if (unreadCount === 1) {
                                body = hasMedia ? `1 new media from ${notifSenderName}!` : `1 new message from ${notifSenderName}!`;
                            } else if (unreadCount > 1) {
                                if (hasMedia && hasText) {
                                    body = `${unreadCount} new messages and media from ${notifSenderName}!`;
                                } else if (hasMedia) {
                                    body = `${unreadCount} new media from ${notifSenderName}!`;
                                } else {
                                    body = `${unreadCount} new messages from ${notifSenderName}!`;
                                }
                            }

                            const pwaTokens = tokens.filter(t => t.deviceType === 'pwa');
                            const browserTokens = tokens.filter(t => t.deviceType === 'browser');

                            let targetTokens = [];
                            if (pwaTokens.length > 0) {
                                targetTokens = pwaTokens.map(t => t.token);
                                console.log(`[Push] Targeting ${targetTokens.length} PWA tokens.`);
                            } else if (browserTokens.length > 0) {
                                targetTokens = browserTokens.map(t => t.token);
                                console.log(`[Push] Targeting ${targetTokens.length} Browser tokens.`);
                            } else if (offlineUser.fcmToken) {
                                targetTokens = [offlineUser.fcmToken];
                                console.log(`[Push] Targeting legacy token.`);
                            }

                            let pushSuccess = false;
                            for (const tkn of targetTokens) {
                                console.log(`[Push] Sending to token: ${tkn.substring(0, 10)}...`);
                                const success = await sendPushNotification(offlineUser._id, tkn, title, body, {
                                    chatId: chatId.toString(),
                                    messageId: message._id.toString(),
                                    type: 'new_message',
                                    isViewOnce: populated.isViewOnce ? "true" : "false"
                                });
                                if (success) {
                                    pushSuccess = true;
                                    console.log(`[Push] Success: Notification reached device (Token: ${tkn.substring(0, 10)}...)`);
                                } else {
                                    console.log(`[Push] Failed: Notification could not reach device (Token: ${tkn.substring(0, 10)}...)`);
                                }
                            }

                            if (pushSuccess) {
                                console.log(`[Push] FCM accepted message ${message._id}. Marking as delivered.`);
                                // Only mark as delivered if not already read/delivered
                                const currentMsg = await Message.findById(message._id);
                                if (currentMsg && currentMsg.status === "sent") {
                                    await Message.findByIdAndUpdate(message._id, { status: "delivered" });
                                    const senderData = onlineUsers.get(userId);
                                    senderData?.sockets?.forEach((dt, sId) => {
                                        io.to(sId).emit("message_delivered", { chatId: chatId.toString(), messageId: message._id.toString() });
                                    });
                                }
                            } else {
                                console.log(`[Push] Final: Notification flow finished with NO successful deliveries.`);
                            }
                        }).catch(err => console.error(`[Push] Critical Error:`, err));
                    }
                });

                if (isDelivered) {
                    const currentMsg = await Message.findById(message._id);
                    if (currentMsg && currentMsg.status === "sent") {
                        await Message.findByIdAndUpdate(message._id, { status: "delivered" });
                        const senderData = onlineUsers.get(userId);
                        senderData?.sockets?.forEach((dt, sId) => {
                            io.to(sId).emit("message_delivered", { chatId: chatId.toString(), messageId: message._id.toString() });
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
                ).populate("senderId", "username avatar createdAt").populate("replyTo");

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
                    await Message.findByIdAndDelete(messageId);
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

        socket.on("typing_start", async ({ chatId, scramble }) => {
            const chat = await Chat.findById(chatId).populate("participants", "privacySettings contacts");
            if (!chat) return;

            const sender = await User.findById(userId).select("privacySettings contacts");
            if (!sender) return;

            const senderPrivacy = sender.privacySettings?.typingIndicator || "everyone";

            const allows = (userA, userBId, privacy) => {
                if (privacy === "everyone") return true;
                if (privacy === "nobody") return false;
                return userA.contacts?.some(c => c.userId.toString() === userBId);
            };

            chat.participants
                .filter(p => p._id.toString() !== userId)
                .forEach(recipient => {
                    const recipientId = recipient._id.toString();
                    const userData = onlineUsers.get(recipientId);

                    if (userData && userData.sockets) {
                        const recipientPrivacy = recipient.privacySettings?.typingIndicator || "everyone";

                        const senderAllowsRecipient = allows(sender, recipientId, senderPrivacy);
                        const recipientAllowsSender = allows(recipient, userId, recipientPrivacy);
                        const mutualConsent = senderAllowsRecipient && recipientAllowsSender;

                        userData.sockets.forEach((dType, sId) => {
                            io.to(sId).emit("typing_status", {
                                userId,
                                chatId,
                                isTyping: true,
                                scramble: mutualConsent ? scramble : null
                            });
                        });
                    }
                });
        });

        socket.on("typing_stop", async ({ chatId }) => {
            const chat = await Chat.findById(chatId);
            if (!chat) return;
            chat.participants
                .filter(p => p.toString() !== userId)
                .forEach(participantId => {
                    const userData = onlineUsers.get(participantId.toString());
                    if (userData && userData.sockets) {
                        userData.sockets.forEach((dType, sId) => {
                            io.to(sId).emit("typing_status", { userId, chatId, isTyping: false });
                        });
                    }
                });
        });

        socket.on("message_read", async ({ chatId }) => {
            try {
                const senderIdCriteria = { $ne: new mongoose.Types.ObjectId(userId) };
                const chatIdCriteria = new mongoose.Types.ObjectId(chatId);

                await Message.updateMany(
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
                socket.emit("message_error", { error: "Failed to update read status" });
            }
        });
    });
};

module.exports = registerSocketHandlers;