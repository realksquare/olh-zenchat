const jwt = require("jsonwebtoken");
const BurnerBridge = require("../models/BurnerBridge");
const BurnerMessage = require("../models/BurnerMessage");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "zenchat-burner-secret-key-fallback";

const socketBurnerAuth = async (socket, next) => {
    try {
        const { token, guestToken } = socket.handshake.auth || {};
        const authToken = token || guestToken;

        if (!authToken) {
            return next(new Error("Authentication error: Token required"));
        }

        const decoded = jwt.verify(authToken, JWT_SECRET);

        if (decoded.role === "guest") {
            socket.isGuest = true;
            socket.senderId = decoded.guestSessionId;
            socket.senderAlias = decoded.alias || "Guest";
            socket.bridgeToken = decoded.bridgeToken;
            return next();
        }

        // Host/User
        const user = await User.findById(decoded._id).select("_id username isSuspended");
        if (!user || user.isSuspended) {
            return next(new Error("Authentication error: User invalid or suspended"));
        }

        socket.isGuest = false;
        socket.senderId = user._id.toString();
        socket.senderAlias = user.username;
        next();
    } catch (err) {
        return next(new Error("Authentication error: Invalid or expired session"));
    }
};

const registerBurnerSocketHandlers = (io) => {
    const burnerNamespace = io.of("/burner");

    burnerNamespace.use(socketBurnerAuth);

    burnerNamespace.on("connection", (socket) => {
        socket.on("join_bridge", async ({ bridgeToken }) => {
            try {
                if (!bridgeToken) return;

                const bridge = await BurnerBridge.findOne({ bridgeToken });
                if (!bridge) {
                    return socket.emit("burner_error", { message: "Bridge not found" });
                }

                if (bridge.status === "burned") {
                    return socket.emit("burner_destroyed", {
                        bridgeToken,
                        burnReason: bridge.burnReason,
                        message: "This bridge has burned into ash.",
                    });
                }

                if (new Date() >= bridge.expiresAt) {
                    bridge.status = "expired";
                    bridge.burnReason = "time_expired";
                    await bridge.save();
                    await BurnerMessage.deleteMany({ bridgeToken });
                    return socket.emit("burner_destroyed", {
                        bridgeToken,
                        burnReason: "time_expired",
                        message: "Bridge session has expired.",
                    });
                }

                socket.join(`burner:${bridgeToken}`);

                // Inform the other party that a peer has connected
                socket.to(`burner:${bridgeToken}`).emit("burner_peer_joined", {
                    senderAlias: socket.senderAlias,
                    isGuest: socket.isGuest,
                    timestamp: new Date(),
                });
            } catch (err) {
                console.error("[Burner Socket] join_bridge error:", err);
            }
        });

        socket.on("burner_send_message", async ({ bridgeToken, content, iv, type = "text" }) => {
            try {
                if (!bridgeToken || !content) return;

                const bridge = await BurnerBridge.findOne({ bridgeToken });
                if (!bridge || bridge.status !== "active" || new Date() >= bridge.expiresAt) {
                    return socket.emit("burner_destroyed", {
                        bridgeToken,
                        burnReason: "time_expired",
                        message: "Bridge is no longer active.",
                    });
                }

                const senderType = socket.isGuest ? "guest" : "creator";

                const newMsg = await BurnerMessage.create({
                    bridgeId: bridge._id,
                    bridgeToken,
                    senderType,
                    senderAlias: socket.senderAlias,
                    senderId: socket.senderId,
                    content,
                    iv: iv || "",
                    type,
                    expiresAt: bridge.expiresAt,
                });

                bridge.messageCount += 1;
                await bridge.save();

                const payload = {
                    _id: newMsg._id,
                    bridgeToken,
                    senderType,
                    senderAlias: socket.senderAlias,
                    senderId: socket.senderId,
                    content: newMsg.content,
                    iv: newMsg.iv,
                    type: newMsg.type,
                    createdAt: newMsg.createdAt,
                };

                burnerNamespace.to(`burner:${bridgeToken}`).emit("burner_message_received", payload);

                // Check message limit auto-burn
                if (bridge.maxMessages > 0 && bridge.messageCount >= bridge.maxMessages) {
                    bridge.status = "burned";
                    bridge.burnReason = "message_limit_reached";
                    await bridge.save();
                    await BurnerMessage.deleteMany({ bridgeToken });

                    setTimeout(() => {
                        burnerNamespace.to(`burner:${bridgeToken}`).emit("burner_destroyed", {
                            bridgeToken,
                            burnReason: "message_limit_reached",
                            message: `Bridge reached message limit of ${bridge.maxMessages} and self-destructed.`,
                        });
                    }, 500);
                }
            } catch (err) {
                console.error("[Burner Socket] send message error:", err);
            }
        });

        socket.on("burner_typing", ({ bridgeToken, isTyping }) => {
            if (!bridgeToken) return;
            socket.to(`burner:${bridgeToken}`).emit("burner_peer_typing", {
                senderAlias: socket.senderAlias,
                isTyping,
            });
        });

        socket.on("burner_burn_now", async ({ bridgeToken }) => {
            try {
                if (!bridgeToken) return;

                const bridge = await BurnerBridge.findOne({ bridgeToken });
                if (bridge) {
                    bridge.status = "burned";
                    bridge.burnReason = "manual_burn";
                    await bridge.save();
                    await BurnerMessage.deleteMany({ bridgeToken });
                }

                burnerNamespace.to(`burner:${bridgeToken}`).emit("burner_destroyed", {
                    bridgeToken,
                    burnReason: "manual_burn",
                    message: "Bridge self-destructed by participant. Zero traces remain.",
                });
            } catch (err) {
                console.error("[Burner Socket] burn now error:", err);
            }
        });

        socket.on("disconnect", () => {
            // Socket automatically leaves rooms upon disconnect
        });
    });
};

module.exports = registerBurnerSocketHandlers;
