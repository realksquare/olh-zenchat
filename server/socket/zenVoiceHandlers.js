const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ZenVoiceRoom = require("../models/ZenVoiceRoom");
const ZenVoiceMessage = require("../models/ZenVoiceMessage");
const { getPseudonymColor } = require("../utils/zenVoiceHelper");

const socketZenVoiceAuth = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.auth.sessionToken;
        if (!token) {
            return next(new Error("Authentication error: No ZenVoice token provided."));
        }
        
        const decoded = jwt.verify(token, process.env.ZENVOICE_JWT_SECRET || process.env.JWT_SECRET || "zenvoice-secret-fallback-key");
        
        const user = await User.findOne({ "zenVoice.pseudonym": decoded.sub });
        if (!user) {
            return next(new Error("Authentication error: User not found."));
        }
        
        if (user.isSuspended) {
            return next(new Error("Authentication error: Your account is suspended."));
        }
        
        if (user.zenVoice?.zenVoiceSuspendedUntil && new Date() < new Date(user.zenVoice.zenVoiceSuspendedUntil)) {
            return next(new Error(`Authentication error: Your ZenVoice access is restricted until ${new Date(user.zenVoice.zenVoiceSuspendedUntil).toLocaleString()}`));
        }
        
        socket.pseudonym = decoded.sub;
        socket.domain = decoded.domain || "";
        socket.userId = user._id.toString();
        next();
    } catch (err) {
        return next(new Error("Authentication error: Invalid or expired token."));
    }
};

const registerZenVoiceSocketHandlers = (io) => {
    const zvNamespace = io.of("/zenvoice");

    zvNamespace.use(socketZenVoiceAuth);

    zvNamespace.on("connection", (socket) => {
        // Join a personal channel for direct user-scoped warnings/notifications
        socket.join(socket.userId);

        socket.on("join_room", async ({ roomId }) => {
            try {
                const room = await ZenVoiceRoom.findOne({ _id: roomId, isActive: true });
                if (!room) {
                    return socket.emit("error", { message: "Room not found or inactive." });
                }

                if (room.allowedDomain && room.allowedDomain !== socket.domain) {
                    return socket.emit("error", { message: "Access denied: Restricted domain." });
                }

                socket.join(roomId.toString());

                // Ensure user is in members list
                if (!room.members.includes(socket.pseudonym)) {
                    room.members.push(socket.pseudonym);
                    room.memberCount = room.members.length;
                    await room.save();
                }

                const clients = await zvNamespace.in(roomId.toString()).fetchSockets();
                const activeCount = clients.length;

                zvNamespace.to(roomId.toString()).emit("member_count", {
                    roomId: roomId.toString(),
                    memberCount: activeCount
                });

                socket.emit("room_joined", { roomId: roomId.toString() });
            } catch (err) {
                console.error("[ZenVoice Socket] join_room error:", err);
                socket.emit("error", { message: "Failed to join room." });
            }
        });

        socket.on("leave_room", async ({ roomId }) => {
            try {
                socket.leave(roomId.toString());
                
                const room = await ZenVoiceRoom.findOneAndUpdate(
                    { _id: roomId, isActive: true },
                    { $pull: { members: socket.pseudonym } },
                    { new: true }
                );

                if (room) {
                    room.memberCount = room.members.length;
                    await room.save();

                    const clients = await zvNamespace.in(roomId.toString()).fetchSockets();
                    const activeCount = clients.length;

                    // Emit updated member count
                    zvNamespace.to(roomId.toString()).emit("member_count", {
                        roomId: roomId.toString(),
                        memberCount: activeCount
                    });

                    // Smoking Feature: nuke private room if empty
                    if (!room.isOfficial && room.members.length === 0) {
                        await ZenVoiceRoom.findByIdAndDelete(room._id);
                        await ZenVoiceMessage.deleteMany({ roomId: room._id });
                    }
                }
            } catch (err) {
                console.error("[ZenVoice Socket] leave_room error:", err);
            }
        });

        socket.on("send_message", async ({ roomId, content, type, mediaUrl, replyTo }) => {
            try {
                if (!content || content.trim().length === 0) return;

                const room = await ZenVoiceRoom.findOne({ _id: roomId, isActive: true });
                if (!room) {
                    return socket.emit("error", { message: "Room not found or inactive." });
                }

                if (room.allowedDomain && room.allowedDomain !== socket.domain) {
                    return socket.emit("error", { message: "Access denied." });
                }

                // Check suspension again
                const user = await User.findById(socket.userId);
                if (user.zenVoice?.zenVoiceSuspendedUntil && new Date() < new Date(user.zenVoice.zenVoiceSuspendedUntil)) {
                    return socket.emit("error", { message: "Your ZenVoice access is temporarily restricted." });
                }

                const pseudonymAvatarColor = getPseudonymColor(socket.pseudonym);
                const message = await ZenVoiceMessage.create({
                    roomId,
                    pseudonym: socket.pseudonym,
                    pseudonymAvatarColor,
                    content: content.trim(),
                    type: type || "text",
                    mediaUrl: mediaUrl || null,
                    replyTo: replyTo || null
                });

                // Update room activity time
                room.lastActivityAt = new Date();
                await room.save();

                let populatedMessage = message;
                if (replyTo) {
                    populatedMessage = await ZenVoiceMessage.findById(message._id).populate("replyTo");
                }

                zvNamespace.to(roomId.toString()).emit("new_message", { message: populatedMessage });
            } catch (err) {
                console.error("[ZenVoice Socket] send_message error:", err);
                socket.emit("error", { message: "Failed to send message." });
            }
        });

        socket.on("edit_message", async ({ messageId, newContent }) => {
            try {
                if (!newContent || newContent.trim().length === 0) return;
                const message = await ZenVoiceMessage.findById(messageId);
                if (!message) return;
                if (message.pseudonym !== socket.pseudonym) return;

                message.content = newContent.trim();
                message.isEdited = true;
                await message.save();

                const populatedMessage = await ZenVoiceMessage.findById(message._id).populate("replyTo");
                zvNamespace.to(message.roomId.toString()).emit("message_edited", { message: populatedMessage });
            } catch (err) {
                console.error("[ZenVoice Socket] edit_message error:", err);
            }
        });

        socket.on("delete_message", async ({ roomId, messageId, deleteFor }) => {
            try {
                const message = await ZenVoiceMessage.findById(messageId);
                if (!message) return;

                if (deleteFor === "everyone") {
                    if (message.pseudonym !== socket.pseudonym) return;
                    message.deletedForEveryone = true;
                    message.content = "";
                    message.mediaUrl = null;
                    await message.save();
                    zvNamespace.to(roomId.toString()).emit("message_deleted", { messageId, deleteFor: "everyone" });
                } else {
                    await ZenVoiceMessage.findByIdAndUpdate(messageId, { $addToSet: { deletedFor: socket.pseudonym } });
                    socket.emit("message_deleted", { messageId, deleteFor: "self" });
                }
            } catch (err) {
                console.error("[ZenVoice Socket] delete_message error:", err);
            }
        });

        socket.on("toggle_star_message", async ({ roomId, messageId }) => {
            try {
                const message = await ZenVoiceMessage.findById(messageId);
                if (!message) return;
                const isStarred = message.starredBy?.includes(socket.pseudonym);
                if (isStarred) {
                    message.starredBy = message.starredBy.filter(p => p !== socket.pseudonym);
                } else {
                    if (!message.starredBy) message.starredBy = [];
                    message.starredBy.push(socket.pseudonym);
                }
                await message.save();
                socket.emit("message_starred_toggled", { messageId, starredBy: message.starredBy });
            } catch (err) {
                console.error("[ZenVoice Socket] toggle_star_message error:", err);
            }
        });

        socket.on("bulk_star_messages", async ({ roomId, messageIds }) => {
            try {
                if (!Array.isArray(messageIds) || messageIds.length === 0) return;
                await ZenVoiceMessage.updateMany(
                    { _id: { $in: messageIds } },
                    { $addToSet: { starredBy: socket.pseudonym } }
                );
                socket.emit("bulk_messages_starred", { messageIds, pseudonym: socket.pseudonym });
            } catch (err) {
                console.error("[ZenVoice Socket] bulk_star_messages error:", err);
            }
        });

        socket.on("bulk_delete_messages", async ({ roomId, messageIds, deleteFor }) => {
            try {
                if (!Array.isArray(messageIds) || messageIds.length === 0) return;

                if (deleteFor === "everyone") {
                    await ZenVoiceMessage.updateMany(
                        { _id: { $in: messageIds }, pseudonym: socket.pseudonym },
                        {
                            deletedForEveryone: true,
                            content: "",
                            mediaUrl: null
                        }
                    );
                    zvNamespace.to(roomId.toString()).emit("bulk_messages_deleted", { messageIds, deleteFor: "everyone" });
                } else {
                    await ZenVoiceMessage.updateMany(
                        { _id: { $in: messageIds } },
                        { $addToSet: { deletedFor: socket.pseudonym } }
                    );
                    socket.emit("bulk_messages_deleted", { messageIds, deleteFor: "self" });
                }
            } catch (err) {
                console.error("[ZenVoice Socket] bulk_delete_messages error:", err);
            }
        });

        socket.on("typing_start", ({ roomId }) => {
            socket.to(roomId.toString()).emit("typing_start", {
                roomId: roomId.toString(),
                pseudonym: socket.pseudonym
            });
        });

        socket.on("typing_stop", ({ roomId }) => {
            socket.to(roomId.toString()).emit("typing_stop", {
                roomId: roomId.toString(),
                pseudonym: socket.pseudonym
            });
        });

        socket.on("disconnecting", async () => {
            const rooms = Array.from(socket.rooms);
            for (const r of rooms) {
                if (r !== socket.id) {
                    const clients = await zvNamespace.in(r).fetchSockets();
                    const activeCount = Math.max(0, clients.length - 1);
                    zvNamespace.to(r).emit("member_count", {
                        roomId: r,
                        memberCount: activeCount
                    });
                }
            }
        });

        socket.on("disconnect", () => {
            // Socket leaves rooms automatically
        });
    });
};

module.exports = registerZenVoiceSocketHandlers;
