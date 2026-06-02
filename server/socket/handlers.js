const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");
const mongoose = require("mongoose");
const { sendPushNotification } = require("../utils/firebase");
const { decompressPacket, compressPacket } = require("../utils/packetCompressor");
const { unpackMessage, isBinaryPacket } = require("../utils/binaryPacker");
const { canSeePresence } = require("../utils/privacyHelper");

const onlineUsers = new Map();
const disconnectTimeouts = new Map();

const cleanupInstantMessages = async (uid, io) => {
    try {
        const chats = await Chat.find({ participants: uid });

        for (const chat of chats) {
            const deleted = await Message.deleteMany({
                chatId: chat._id,
                disappearingMode: "instant",
                status: "read",
                senderId: { $ne: new mongoose.Types.ObjectId(uid) }
            });

            if (deleted.deletedCount > 0) {
                const latestMsg = await Message.findOne({
                    chatId: chat._id,
                    $or: [
                        { disappearingMode: { $ne: "instant" } },
                        { status: { $ne: "read" } },
                        { senderId: new mongoose.Types.ObjectId(uid) }
                    ]
                })
                    .sort({ createdAt: -1 })
                    .select("_id");

                await Chat.findByIdAndUpdate(chat._id, {
                    lastMessage: latestMsg ? latestMsg._id : null
                });

                io.to(chat._id.toString()).emit("instant_messages_deleted", {
                    chatId: chat._id.toString()
                });
            }
        }
    } catch (err) {
        console.error("[Cleanup] Instant messages failed:", err);
    }
};

const broadcastUserStatus = async (uid, isOnline, lastSeen = null, io) => {
    try {
        const user = await User.findById(uid).select("privacySettings contacts blockedUsers");
        if (!user) return;

        const privacy = user.privacySettings?.onlineStatus || "everyone";

        for (const [targetId, targetData] of onlineUsers.entries()) {
            if (targetId === uid) continue;

            const targetUser = await User.findById(targetId).select("privacySettings contacts blockedUsers");
            const theyBlockedUs = targetUser?.blockedUsers?.some(u => u.userId.toString() === uid.toString());
            const weBlockedThem = user?.blockedUsers?.some(u => u.userId.toString() === targetId.toString());
            if (theyBlockedUs || weBlockedThem) {
                continue;
            }

            let canSee = false;
            if (targetUser) {
                canSee = canSeePresence(user, targetUser);
            }

            if (canSee) {
                targetData.sockets.forEach((sData, sId) => {
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

const broadcastUserLowBandwidth = async (uid, isLowBandwidth, io) => {
    try {
        const user = await User.findById(uid).select("privacySettings contacts blockedUsers");
        if (!user) return;

        for (const [targetId, targetData] of onlineUsers.entries()) {
            if (targetId === uid) continue;

            const targetUser = await User.findById(targetId).select("blockedUsers");
            const theyBlockedUs = targetUser?.blockedUsers?.some(u => u.userId.toString() === uid.toString());
            const weBlockedThem = user?.blockedUsers?.some(u => u.userId.toString() === targetId.toString());
            if (theyBlockedUs || weBlockedThem) {
                continue;
            }

            const hasMutualChat = await Chat.findOne({
                participants: { $all: [new mongoose.Types.ObjectId(uid), new mongoose.Types.ObjectId(targetId)] }
            }).select("_id").lean();

            if (hasMutualChat) {
                targetData.sockets.forEach((sData, sId) => {
                    io.to(sId).emit("peer_low_bandwidth", { userId: uid, isLowBandwidth });
                });
            }
        }
    } catch (err) {
        console.error("Error broadcasting low bandwidth:", err);
    }
};

const setUserActivePresence = async (io, userId, isActive, socketId = null) => {
    if (!userId) return;

    if (!onlineUsers.has(userId)) {
        if (!isActive) {
            const now = new Date();
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: now });
            await broadcastUserStatus(userId, false, now, io);
            await cleanupInstantMessages(userId, io);
        } else {
            await User.findByIdAndUpdate(userId, { isOnline: true });
            await broadcastUserStatus(userId, true, null, io);
        }
        return;
    }

    const userData = onlineUsers.get(userId);
    if (userData && userData.sockets) {
        if (socketId && userData.sockets.has(socketId)) {
            userData.sockets.get(socketId).isActive = isActive;
        } else if (!socketId) {
            userData.sockets.forEach((sData) => {
                sData.isActive = isActive;
            });
        }
    }

    const isAnyActive = userData && userData.sockets 
        ? Array.from(userData.sockets.values()).some(s => s.isActive)
        : false;

    if (!isAnyActive) {
        if (!disconnectTimeouts.has(userId + "_inactive")) {
            const timeout = setTimeout(async () => {
                const checkData = onlineUsers.get(userId);
                const stillAnyActive = checkData && checkData.sockets 
                    ? Array.from(checkData.sockets.values()).some(s => s.isActive)
                    : false;
                if (stillAnyActive) {
                    disconnectTimeouts.delete(userId + "_inactive");
                    return;
                }
                const now = new Date();
                await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: now });
                await broadcastUserStatus(userId, false, now, io);
                await cleanupInstantMessages(userId, io);
            }, 5000);
            disconnectTimeouts.set(userId + "_inactive", timeout);
        }
    } else {
        if (disconnectTimeouts.has(userId + "_inactive")) {
            clearTimeout(disconnectTimeouts.get(userId + "_inactive"));
            disconnectTimeouts.delete(userId + "_inactive");
        }
        await User.findByIdAndUpdate(userId, { isOnline: true });
        await broadcastUserStatus(userId, true, null, io);
    }
};

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
            userData.sockets.set(socket.id, { deviceType: deviceType || "browser", isActive: true });
            userData.hasPWA = Array.from(userData.sockets.values()).some(s => s.deviceType === "pwa");

            if (userData.sockets.size === 1) {
                User.findByIdAndUpdate(userId, { isOnline: true }).exec();
                broadcastUserStatus(userId, true, null, io);
            }

            socket.on("set_active_status", ({ isActive }) => {
                setUserActivePresence(io, userId, isActive, socket.id);
            });

            socket.on("zen_mode_status", ({ isZenMode }) => {
                if (userData) {
                    userData.isZenMode = isZenMode;
                }
                io.emit("user_zen_status", { userId, isZenMode });
            });

            socket.on("update_active_time", async ({ additionalMinutes, contactId }) => {
                try {
                    const user = await User.findById(userId);
                    if (!user) return;
                    
                    user.activeTimeMinutes = (user.activeTimeMinutes || 0) + additionalMinutes;
                    if (contactId) {
                        if (!user.perContactActiveTime) {
                            user.perContactActiveTime = new Map();
                        }
                        const currentVal = user.perContactActiveTime.get(contactId) || 0;
                        user.perContactActiveTime.set(contactId, currentVal + additionalMinutes);
                    }
                    await user.save();
                } catch (err) {
                    console.error("[Socket] Failed to update active time:", err);
                }
            });

            socket.on("disconnect", () => {
                if (userData && userData.sockets.has(socket.id)) {
                    userData.sockets.delete(socket.id);
                    userData.hasPWA = Array.from(userData.sockets.values()).some(s => s.deviceType === "pwa");

                    if (userData.sockets.size === 0) {
                        const timeout = setTimeout(async () => {
                            const checkData = onlineUsers.get(userId);
                            if (checkData && checkData.sockets.size > 0) {
                                disconnectTimeouts.delete(userId);
                                return;
                            }

                            const now = new Date();
                            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: now });
                            
                            const recheckData = onlineUsers.get(userId);
                            if (recheckData && recheckData.sockets.size > 0) {
                                disconnectTimeouts.delete(userId);
                                return;
                            }

                            onlineUsers.delete(userId);
                            disconnectTimeouts.delete(userId);
                            if (disconnectTimeouts.has(userId + "_inactive")) {
                                clearTimeout(disconnectTimeouts.get(userId + "_inactive"));
                                disconnectTimeouts.delete(userId + "_inactive");
                            }
                            broadcastUserStatus(userId, false, now, io);
                            await cleanupInstantMessages(userId, io);
                        }, 5000);
                        disconnectTimeouts.set(userId, timeout);
                    } else {
                        // Re-evaluate if remaining sockets are active
                        const isAnyActive = Array.from(userData.sockets.values()).some(s => s.isActive);
                        if (!isAnyActive) {
                            if (!disconnectTimeouts.has(userId + "_inactive")) {
                                const timeout = setTimeout(async () => {
                                    const checkData = onlineUsers.get(userId);
                                    if (checkData && Array.from(checkData.sockets.values()).some(s => s.isActive)) {
                                        disconnectTimeouts.delete(userId + "_inactive");
                                        return;
                                    }
                                    
                                    const now = new Date();
                                    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: now });
                                    
                                    const recheckData = onlineUsers.get(userId);
                                    if (recheckData && Array.from(recheckData.sockets.values()).some(s => s.isActive)) {
                                        disconnectTimeouts.delete(userId + "_inactive");
                                        return;
                                    }

                                    broadcastUserStatus(userId, false, now, io);
                                    await cleanupInstantMessages(userId, io);
                                    disconnectTimeouts.delete(userId + "_inactive");
                                }, 5000);
                                disconnectTimeouts.set(userId + "_inactive", timeout);
                            }
                        }
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

                        pendingMessages.forEach((msg) => {
                            socket.emit("receive_message", {
                                message: { ...msg.toObject(), chatId: msg.chatId.toString() }
                            });
                        });

                        pendingMessages.forEach((msg) => {
                            if (!msg.senderId) return;
                            const senderSockets = onlineUsers.get(msg.senderId._id?.toString() || msg.senderId.toString());
                            if (senderSockets && senderSockets.sockets) {
                                senderSockets.sockets.forEach((sData, socketId) => {
                                    io.to(socketId).emit("message_delivered", {
                                        messageId: msg._id.toString(),
                                        chatId: msg.chatId.toString(),
                                    });
                                });
                            }
                        });
                    }

                    const visibleOnlineUserIds = [];
                    for (const [otherId, otherData] of onlineUsers.entries()) {
                        if (otherId === userId) continue;

                        const otherUser = await User.findById(otherId).select("privacySettings contacts blockedUsers");
                        if (!otherUser) continue;

                        const me = await User.findById(userId).select("privacySettings contacts blockedUsers");
                        const theyBlockedMe = otherUser?.blockedUsers?.some(u => u.userId.toString() === userId.toString());
                        const iBlockedThem = me?.blockedUsers?.some(u => u.userId.toString() === otherId.toString());
                        if (theyBlockedMe || iBlockedThem) {
                            continue;
                        }

                        let canSee = false;
                        if (me) {
                            canSee = canSeePresence(otherUser, me);
                        }

                        if (canSee) {
                            visibleOnlineUserIds.push(otherId);
                            if (otherData?.isZenMode) {
                                socket.emit("user_zen_status", { userId: otherId, isZenMode: true });
                            }
                            const isOtherLowBandwidth = otherData && otherData.sockets
                                ? Array.from(otherData.sockets.values()).some(s => s.isLowBandwidth)
                                : false;
                            if (isOtherLowBandwidth) {
                                socket.emit("peer_low_bandwidth", { userId: otherId, isLowBandwidth: true });
                            }
                        }
                    }
                    socket.emit("online_users", { userIds: visibleOnlineUserIds });

                } catch (err) {
                    console.error("Error in connection async block:", err);
                }
            })();


        socket.on("join_chat", ({ chatId, isLowBandwidth }) => {
            socket.join(chatId);
            if (userData && userData.sockets.has(socket.id)) {
                const sData = userData.sockets.get(socket.id);
                sData.isLowBandwidth = isLowBandwidth;
            }
            if (isLowBandwidth !== undefined) {
                broadcastUserLowBandwidth(userId, isLowBandwidth, io);
            }
        });

        socket.on("update_low_bandwidth", async ({ chatId, isLowBandwidth }) => {
            if (userData && userData.sockets.has(socket.id)) {
                userData.sockets.get(socket.id).isLowBandwidth = isLowBandwidth;
            }
            await broadcastUserLowBandwidth(userId, isLowBandwidth, io);
        });

        socket.on("leave_chat", ({ chatId }) => {
            socket.leave(chatId);
        });

        socket.on("zen_session_clear", async ({ chatId, messageIds }) => {
            try {
                if (!messageIds || messageIds.length === 0) return;
                const chat = await Chat.findOne({ _id: chatId, participants: userId }).select("_id").lean();
                if (!chat) return;
                await Message.deleteMany({ _id: { $in: messageIds } });
                io.to(chatId).emit("zen_messages_cleared", { chatId });
            } catch (err) {
                console.error("Error clearing zen session messages:", err);
            }
        });

        socket.on("zen_invite_send", ({ chatId, senderId, receiverId }) => {
            const recUserData = onlineUsers.get(receiverId);
            if (recUserData && recUserData.sockets) {
                recUserData.sockets.forEach((sData, socketId) => {
                    io.to(socketId).emit("zen_receive_invite", { chatId, senderId, receiverId });
                });
            }
        });

        socket.on("zen_invite_respond", ({ chatId, responderId, requesterId, receiverId, accepted }) => {
            if (accepted) {
                const reqUserData = onlineUsers.get(requesterId);
                const respUserData = onlineUsers.get(responderId);
                if (reqUserData) reqUserData.isZenMode = true;
                if (respUserData) respUserData.isZenMode = true;

                io.emit("user_zen_status", { userId: requesterId, isZenMode: true });
                io.emit("user_zen_status", { userId: responderId, isZenMode: true });
            }

            const reqUserData = onlineUsers.get(requesterId);
            if (reqUserData && reqUserData.sockets) {
                reqUserData.sockets.forEach((sData, socketId) => {
                    io.to(socketId).emit("zen_invite_result", { chatId, responderId, requesterId, receiverId, accepted });
                });
            }
            const respUserData = onlineUsers.get(responderId);
            if (respUserData && respUserData.sockets) {
                respUserData.sockets.forEach((sData, socketId) => {
                    io.to(socketId).emit("zen_invite_result", { chatId, responderId, requesterId, receiverId, accepted });
                });
            }

            // Propagate early cancellation to the invitee (User B) if A cancelled
            if (!accepted && receiverId && responderId === requesterId) {
                const recUserData = onlineUsers.get(receiverId);
                if (recUserData && recUserData.sockets) {
                    recUserData.sockets.forEach((sData, socketId) => {
                        io.to(socketId).emit("zen_invite_result", { chatId, responderId, requesterId, receiverId, accepted });
                    });
                }
            }
        });

        socket.on("zen_exit_request", ({ chatId, senderId, receiverId }) => {
            const recUserData = onlineUsers.get(receiverId);
            if (recUserData && recUserData.sockets) {
                recUserData.sockets.forEach((sData, socketId) => {
                    io.to(socketId).emit("zen_receive_exit_request", { chatId, senderId, receiverId });
                });
            }
        });

        socket.on("zen_exit_respond", ({ chatId, responderId, requesterId, accepted }) => {
            if (accepted) {
                const reqUserData = onlineUsers.get(requesterId);
                const respUserData = onlineUsers.get(responderId);
                if (reqUserData) reqUserData.isZenMode = false;
                if (respUserData) respUserData.isZenMode = false;

                io.emit("user_zen_status", { userId: requesterId, isZenMode: false });
                io.emit("user_zen_status", { userId: responderId, isZenMode: false });
            }

            const reqUserData = onlineUsers.get(requesterId);
            if (reqUserData && reqUserData.sockets) {
                reqUserData.sockets.forEach((sData, socketId) => {
                    io.to(socketId).emit("zen_exit_result", { chatId, responderId, requesterId, accepted });
                });
            }
            const respUserData = onlineUsers.get(responderId);
            if (respUserData && respUserData.sockets) {
                respUserData.sockets.forEach((sData, socketId) => {
                    io.to(socketId).emit("zen_exit_result", { chatId, responderId, requesterId, accepted });
                });
            }
        });

        socket.on("zen_exit_cancel", ({ receiverId }) => {
            const recUserData = onlineUsers.get(receiverId);
            if (recUserData && recUserData.sockets) {
                recUserData.sockets.forEach((sData, socketId) => {
                    io.to(socketId).emit("zen_exit_cancel_receive");
                });
            }
        });

        socket.on("send_message", async (rawPayload) => {
            try {
                const unpacked = isBinaryPacket(rawPayload) ? unpackMessage(rawPayload) : rawPayload;
                const decompressed = decompressPacket(unpacked);
                const { chatId, content, type, mediaUrl, replyTo, isViewOnce, cid, isEncrypted, encryptedSymmetricKey, iv, isLowBandwidth, isZenMessage, waveform } = decompressed;

                const chat = await Chat.findById(chatId).populate("participants", "privacySettings contacts");
                if (!chat) return;

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
                    disappearingMode: chat.disappearingMode || "off",
                    isEncrypted: isEncrypted || false,
                    encryptedSymmetricKey: encryptedSymmetricKey || "",
                    iv: iv || "",
                    isLowBandwidth: isLowBandwidth || false,
                    isZenMessage: isZenMessage || false,
                    waveform: waveform || ""
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

                const participants = chat.participants;

                const allows = (userA, userBId, privacy) => {
                    if (privacy === "everyone") return true;
                    if (privacy === "nobody") return false;
                    if (!userA || !userA.contacts) return false;
                    return userA.contacts.some(c => {
                        if (!c || !c.userId) return false;
                        const cIdStr = c.userId._id ? c.userId._id.toString() : c.userId.toString();
                        return cIdStr === userBId.toString();
                    });
                };

                await Promise.all(participants.map(async (participant) => {
                    const pIdStr = participant._id.toString();

                    let canSeeScramble = false;
                    if (pIdStr !== userId.toString()) {
                        const recUser = await User.findById(pIdStr).select("privacySettings contacts");
                        if (recUser) {
                            const recipientPrivacy = recUser.privacySettings?.typingIndicator || "everyone";
                            const senderAllowsRecipient = allows(sender, pIdStr, typingPrivacy);
                            const recipientAllowsSender = allows(recUser, userId, recipientPrivacy);
                            canSeeScramble = !isLowBandwidth && senderAllowsRecipient && recipientAllowsSender;
                        }
                    }

                    const messagePayload = { ...messagePayloadBase, canSeeScramble };

                    const userData = onlineUsers.get(pIdStr);
                    if (userData && userData.sockets && userData.sockets.size > 0) {
                        userData.sockets.forEach((sData, socketId) => {
                            const payloadToSend = pIdStr === userId.toString() ? messagePayloadBase : messagePayload;
                            io.to(socketId).emit("receive_message", { message: payloadToSend });
                        });
                    }
                }));

                let isDelivered = false;
                const otherParticipants = participants.filter(p => (p._id?.toString() || p.toString()) !== userId.toString());
                otherParticipants.forEach((participant) => {
                    const pIdStr = participant._id?.toString() || participant.toString();
                    const userData = onlineUsers.get(pIdStr);

                    const hasActiveSocket = userData && userData.sockets && Array.from(userData.sockets.values()).some(s => s.isActive);

                    if (hasActiveSocket) {
                        isDelivered = true;
                    } else {
                        User.findById(pIdStr).then(async (offlineUser) => {
                            if (!offlineUser || !offlineUser.notificationsEnabled) return;

                            const tokens = offlineUser.fcmTokens || [];
                            if (tokens.length === 0 && !offlineUser.fcmToken) return;

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
                            const hasMedia = unreadMessages.some(m => ['image', 'video', 'gif', 'sticker', 'audio', 'voice'].includes(m.type));
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
                            } else if (browserTokens.length > 0) {
                                targetTokens = browserTokens.map(t => t.token);
                            } else if (offlineUser.fcmToken) {
                                targetTokens = [offlineUser.fcmToken];
                            }

                            let pushSuccess = false;
                            const sendPromises = targetTokens.map(tkn => 
                                sendPushNotification(offlineUser._id, tkn, title, body, {
                                    chatId: chatId.toString(),
                                    messageId: message._id.toString(),
                                    type: 'new_message',
                                    isViewOnce: populated.isViewOnce ? "true" : "false"
                                })
                            );
                            const results = await Promise.all(sendPromises);
                            if (results.some(success => success)) pushSuccess = true;

                            if (pushSuccess) {
                                const currentMsg = await Message.findById(message._id);
                                if (currentMsg && currentMsg.status === "sent") {
                                    await Message.findByIdAndUpdate(message._id, { status: "delivered" });
                                    const senderData = onlineUsers.get(userId);
                                    senderData?.sockets?.forEach((sData, sId) => {
                                        io.to(sId).emit("message_delivered", { chatId: chatId.toString(), messageId: message._id.toString() });
                                    });
                                }
                            }
                        }).catch(err => console.error(`[Push] Error:`, err));
                    }
                });

                if (isDelivered) {
                    const currentMsg = await Message.findById(message._id);
                    if (currentMsg && currentMsg.status === "sent") {
                        await Message.findByIdAndUpdate(message._id, { status: "delivered" });
                        const senderData = onlineUsers.get(userId);
                        senderData?.sockets?.forEach((sData, sId) => {
                            io.to(sId).emit("message_delivered", { chatId: chatId.toString(), messageId: message._id.toString() });
                        });
                    }
                }

            } catch (err) {
                socket.emit("message_error", { error: "Failed to send message" });
            }
        });

        socket.on("edit_message", async ({ chatId, messageId, newContent, encryptedContent, encryptedSymmetricKey, iv, isEncrypted }) => {
            try {
                const message = await Message.findById(messageId);
                if (!message || message.senderId.toString() !== userId) return;

                const updateFields = { isEdited: true, editedAt: new Date() };
                if (isEncrypted) {
                    updateFields.content = encryptedContent;
                    updateFields.encryptedSymmetricKey = encryptedSymmetricKey;
                    updateFields.iv = iv;
                    updateFields.isEncrypted = true;
                } else {
                    updateFields.content = newContent.trim();
                }

                const updated = await Message.findByIdAndUpdate(
                    messageId,
                    updateFields,
                    { new: true }
                ).populate("senderId", "username avatar createdAt").populate("replyTo");

                const editPayload = { ...updated.toObject(), chatId: chatId.toString() };
                io.to(chatId).emit("message_edited", { message: editPayload });

                const chat = await Chat.findById(chatId);
                chat.participants.filter(p => p.toString() !== userId).forEach(participantId => {
                    const userData = onlineUsers.get(participantId.toString());
                    if (userData && userData.sockets) {
                        userData.sockets.forEach((sData, socketId) => {
                            const room = io.sockets.adapter.rooms.get(chatId);
                            if (!room?.has(socketId)) {
                                io.to(socketId).emit("message_edited", { message: editPayload });
                            }
                        });
                    }
                });

                const myData = onlineUsers.get(userId);
                if (myData && myData.sockets) {
                    myData.sockets.forEach((sData, socketId) => {
                        if (socketId !== socket.id) io.to(socketId).emit("message_edited", { message: editPayload });
                    });
                }
            } catch (err) {
                socket.emit("message_error", { error: "Failed to edit message" });
            }
        });

        socket.on("message_react", async ({ chatId, messageId, emoji }) => {
            try {
                const message = await Message.findById(messageId);
                if (!message) return;

                if (!message.reactions) {
                    message.reactions = [];
                }

                let action = null;
                const existingIndex = message.reactions.findIndex(
                    (r) => r.userId.toString() === userId.toString()
                );

                if (existingIndex > -1) {
                    if (message.reactions[existingIndex].emoji === emoji) {
                        message.reactions.splice(existingIndex, 1);
                        action = 'removed';
                    } else {
                        message.reactions[existingIndex].emoji = emoji;
                        action = 'updated';
                    }
                } else {
                    message.reactions.push({ userId, emoji });
                    action = 'added';
                }

                await message.save();

                const payload = {
                    _id: messageId.toString(),
                    chatId: chatId.toString(),
                    reactions: message.reactions.map(r => ({
                        userId: r.userId.toString(),
                        emoji: r.emoji
                    }))
                };

                io.to(chatId).emit("message_reaction_updated", payload);

                const chat = await Chat.findById(chatId);
                if (chat) {
                    chat.participants.filter(p => p.toString() !== userId).forEach(participantId => {
                        const userData = onlineUsers.get(participantId.toString());
                        if (userData && userData.sockets) {
                            userData.sockets.forEach((sData, socketId) => {
                                const room = io.sockets.adapter.rooms.get(chatId);
                                if (!room?.has(socketId)) {
                                    io.to(socketId).emit("message_reaction_updated", payload);
                                }
                            });
                        }
                    });
                }

                const myData = onlineUsers.get(userId);
                if (myData && myData.sockets) {
                    myData.sockets.forEach((sData, socketId) => {
                        if (socketId !== socket.id) {
                            io.to(socketId).emit("message_reaction_updated", payload);
                        }
                    });
                }

                if ((action === 'added' || action === 'updated') && message.senderId.toString() !== userId.toString()) {
                    const reactor = await User.findById(userId).select("username contacts");
                    const targetUser = await User.findById(message.senderId).select("notificationsEnabled fcmTokens contacts _id");
                    
                    if (targetUser && targetUser.notificationsEnabled) {
                        const targetData = onlineUsers.get(targetUser._id.toString());
                        const hasActiveSocket = targetData && targetData.sockets && Array.from(targetData.sockets.values()).some(s => s.isActive);
                        
                        if (!hasActiveSocket && targetUser.fcmTokens?.length > 0) {
                            const senderIsContact = targetUser.contacts?.some(
                                c => c.userId?.toString() === userId.toString()
                            );
                            const notifSenderName = senderIsContact ? `${reactor.username} ✨` : reactor.username;
                            
                            const title = "ZenChat";
                            const body = `${notifSenderName} reacted to your message: ${emoji}`;
                            
                            const pwaTokens = targetUser.fcmTokens.filter(t => t.deviceType === 'pwa');
                            const browserTokens = targetUser.fcmTokens.filter(t => t.deviceType === 'browser');
                            
                            let targetTokens = [];
                            if (pwaTokens.length > 0) {
                                targetTokens = pwaTokens.map(t => t.token);
                            } else if (browserTokens.length > 0) {
                                targetTokens = browserTokens.map(t => t.token);
                            }

                            targetTokens.forEach(tkn => {
                                sendPushNotification(targetUser._id, tkn, title, body, {
                                    chatId: chatId.toString(),
                                    messageId: messageId.toString(),
                                    type: 'reaction'
                                }).catch(err => console.error("[Reaction Push] Error:", err));
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to react to message:", err);
            }
        });

        socket.on("delete_message", async ({ chatId, messageId, deleteFor }) => {
            try {
                const message = await Message.findById(messageId);
                if (!message) {
                    socket.emit("message_deleted", { messageId: messageId.toString(), chatId: chatId.toString(), deleteFor: "self" });
                    return;
                }
                if (message.senderId.toString() !== userId) return;

                if (deleteFor === "everyone") {
                    await Message.findByIdAndDelete(messageId);
                    io.to(chatId).emit("message_deleted", { messageId: messageId.toString(), chatId: chatId.toString(), deleteFor: "everyone" });

                    const chat = await Chat.findById(chatId);
                    chat.participants.filter(p => p.toString() !== userId).forEach(participantId => {
                        const userData = onlineUsers.get(participantId.toString());
                        if (userData && userData.sockets) {
                            userData.sockets.forEach((sData, socketId) => {
                                const room = io.sockets.adapter.rooms.get(chatId);
                                if (!room?.has(socketId)) io.to(socketId).emit("message_deleted", { messageId: messageId.toString(), chatId: chatId.toString(), deleteFor: "everyone" });
                            });
                        }
                    });

                    const myData = onlineUsers.get(userId);
                    if (myData && myData.sockets) {
                        myData.sockets.forEach((sData, socketId) => {
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
            const chat = await Chat.findById(chatId).select("participants").lean();
            if (!chat) return;

            chat.participants
                .filter(p => p.toString() !== userId)
                .forEach(participant => {
                    const recipientId = participant._id?.toString() || participant.toString();
                    const userData = onlineUsers.get(recipientId);

                    if (userData && userData.sockets) {
                        userData.sockets.forEach((sData, sId) => {
                            io.to(sId).emit("typing_status", {
                                userId,
                                chatId,
                                isTyping: true,
                                scramble: scramble
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
                        userData.sockets.forEach((sData, sId) => {
                            io.to(sId).emit("typing_status", { userId, chatId, isTyping: false });
                        });
                    }
                });
        });

        // Voice recording indicators — simple relay, no privacy check needed
        socket.on("voice_recording_start", async ({ chatId }) => {
            try {
                const chat = await Chat.findById(chatId);
                if (!chat) return;
                chat.participants
                    .filter(p => p.toString() !== userId)
                    .forEach(participantId => {
                        const userData = onlineUsers.get(participantId.toString());
                        if (userData?.sockets) {
                            userData.sockets.forEach((sData, sId) => {
                                io.to(sId).emit("voice_recording_status", { userId, chatId, isRecording: true });
                            });
                        }
                    });
            } catch (_) {}
        });

        socket.on("voice_recording_stop", async ({ chatId }) => {
            try {
                const chat = await Chat.findById(chatId);
                if (!chat) return;
                chat.participants
                    .filter(p => p.toString() !== userId)
                    .forEach(participantId => {
                        const userData = onlineUsers.get(participantId.toString());
                        if (userData?.sockets) {
                            userData.sockets.forEach((sData, sId) => {
                                io.to(sId).emit("voice_recording_status", { userId, chatId, isRecording: false });
                            });
                        }
                    });
            } catch (_) {}
        });

        socket.on("message_read", async ({ chatId }) => {
            try {
                const senderIdCriteria = { $ne: new mongoose.Types.ObjectId(userId) };
                const chatIdCriteria = new mongoose.Types.ObjectId(chatId);

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
                    { chatId: chatIdCriteria, senderId: senderIdCriteria, status: { $ne: "read" } },
                    updatePipeline
                );

                const chat = await Chat.findById(chatId);
                if (!chat) return;

                chat.participants
                    .filter(p => p.toString() !== userId)
                    .forEach(participantId => {
                        const userData = onlineUsers.get(participantId.toString());
                        if (userData && userData.sockets) {
                            userData.sockets.forEach((sData, socketId) => {
                                io.to(socketId).emit("messages_read", { chatId: chatId.toString(), readBy: userId });
                            });
                        }
                    });

                const myData = onlineUsers.get(userId);
                if (myData && myData.sockets) {
                    myData.sockets.forEach((sData, socketId) => {
                        if (socketId !== socket.id) {
                            io.to(socketId).emit("messages_read", { chatId: chatId.toString(), readBy: userId });
                        }
                    });
                }
            } catch (err) {
                socket.emit("message_error", { error: "Failed to update read status" });
            }
        });
    }
});
};

registerSocketHandlers.registerSocketHandlers = registerSocketHandlers;
registerSocketHandlers.setUserActivePresence = setUserActivePresence;
registerSocketHandlers.onlineUsers = onlineUsers;
module.exports = registerSocketHandlers;