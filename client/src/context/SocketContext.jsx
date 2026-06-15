import { createContext, useContext, useEffect, useRef, useCallback, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { playReceiveSound, getAudioContext } from "../utils/audio";
import { useMomentStore } from "../stores/momentStore";
import { enqueueOutbox, drainOutbox, drainPendingMedia } from "../db/zenDB";
import { decryptMessageIfNeeded } from "../utils/e2eeHelper";
import { encryptMessageContent, encryptMessageContentForBoth } from "../utils/crypto";
import axiosInstance from "../utils/axios";
import { decompressPacket, compressPacket } from "../utils/packetCompressor";
import { packMessage, unpackMessage, isBinaryPacket, hexToBytes, bytesToHex } from "../utils/binaryPacker";



const publicKeyCache = new Map();

const getCachedPublicKey = async (userId) => {
    if (!userId) return null;
    const uidStr = userId.toString();
    const cached = publicKeyCache.get(uidStr);
    if (cached) return cached;
    try {
        const { data } = await axiosInstance.get(`/auth/users/${uidStr}/public-key`);
        if (data?.publicKey) {
            publicKeyCache.set(uidStr, data.publicKey);
            return data.publicKey;
        }
    } catch (err) {
        console.error(`[E2EE Cache] Failed to fetch public key for ${uidStr}:`, err);
    }
    return null;
};

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const pendingOnlineReconcileRef = useRef(null);
    const userId = useAuthStore((state) => state.user?._id);
    const token = useAuthStore((state) => state.token);

    // Global ZenMode States
    const [incomingZenInvite, setIncomingZenInvite] = useState(null);
    const [incomingZenExit, setIncomingZenExit] = useState(null);
    const [zenWaitingState, setZenWaitingState] = useState(null);
    const [zenCountdown, setZenCountdown] = useState(0);
    const [zenToast, setZenToast] = useState(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Global ZenMode Refs
    const zenWaitingTimeoutRef = useRef(null);
    const zenCountdownIntervalRef = useRef(null);
    const zenToastTimeoutRef = useRef(null);
    const zenExitTimeoutCountRef = useRef(0);

    const clearZenTimers = useCallback(() => {
        if (zenWaitingTimeoutRef.current) {
            clearTimeout(zenWaitingTimeoutRef.current);
            zenWaitingTimeoutRef.current = null;
        }
        if (zenCountdownIntervalRef.current) {
            clearInterval(zenCountdownIntervalRef.current);
            zenCountdownIntervalRef.current = null;
        }
    }, []);

    const showZenToast = useCallback((type, text) => {
        if (zenToastTimeoutRef.current) {
            clearTimeout(zenToastTimeoutRef.current);
        }
        setZenToast({ type, text });
        zenToastTimeoutRef.current = setTimeout(() => {
            setZenToast(null);
            zenToastTimeoutRef.current = null;
        }, 4000);
    }, []);

    const startZenTimer = useCallback((type, chatId, senderId, receiverId) => {
        clearZenTimers();
        let remaining = 18;
        setZenCountdown(remaining);

        zenCountdownIntervalRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining >= 0) {
                setZenCountdown(remaining);
            }
        }, 1000);

        zenWaitingTimeoutRef.current = setTimeout(() => {
            clearZenTimers();
            if (type === "invite-waiting" || type === "exit-waiting") {
                if (type === "exit-waiting") {
                    zenExitTimeoutCountRef.current += 1;
                    if (zenExitTimeoutCountRef.current >= 2) {
                        clearZenTimers();
                        zenExitTimeoutCountRef.current = 0;
                        socketRef.current?.emit("zen_exit_respond", {
                            chatId,
                            responderId: userId,
                            requesterId: receiverId || senderId,
                            accepted: true
                        });
                        showZenToast("success", "ZenMode ended after consecutive timeouts");
                        setZenWaitingState(null);
                        return;
                    }
                }
                setZenWaitingState("no-response");
                showZenToast("info", "User didn't respond");
                setTimeout(() => {
                    setZenWaitingState(null);
                }, 3000);
            }
        }, 18000);
    }, [clearZenTimers, showZenToast, userId]);

    useEffect(() => {
        if (!token || !userId) return;

        const serverUrl = import.meta.env.VITE_API_URL || "/";
        const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

        socketRef.current = io(serverUrl, {
            auth: { 
                userId: userId,
                deviceType: isPWA ? "pwa" : "browser"
            },
            extraHeaders: { Authorization: `Bearer ${token}` },
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.5,
            timeout: 20000,
            transports: ["websocket", "polling"],
        });

        const socket = socketRef.current;

        const getThumbnailUrl = (url) => {
            if (!url || !url.includes("cloudinary.com")) return url;
            return url.replace("/upload/", "/upload/c_limit,w_800,q_auto,f_auto/");
        };

        const handleReceiveMessage = async ({ message }) => {
            const raw = isBinaryPacket(message) ? unpackMessage(message) : message;
            const decompressed = decompressPacket(raw);
            // Decrypt transparently in background before saving/state updates
            await decryptMessageIfNeeded(decompressed);

            if (decompressed.mediaUrl) {
                decompressed.mediaUrl = getThumbnailUrl(decompressed.mediaUrl);
            }

            const existingChat = useChatStore.getState().chats.find(
                (c) => c._id?.toString() === decompressed.chatId?.toString()
            );

            if (!existingChat) {
                await useChatStore.getState().fetchChats();
            }

            useChatStore.getState().addMessage(decompressed.chatId, decompressed);

            const activeChat = useChatStore.getState().activeChat;
            const currentUserId = useAuthStore.getState().user?._id;
            const isFromMe =
                decompressed.senderId?.toString() === currentUserId?.toString() ||
                decompressed.senderId?._id?.toString() === currentUserId?.toString();

            if (activeChat?._id?.toString() === decompressed.chatId?.toString() && !isFromMe) {
                const isClientActive = typeof document !== 'undefined' &&
                    document.visibilityState === "visible" &&
                    (window.innerWidth <= 768 ? true : document.hasFocus());
                if (isClientActive) {
                    socketRef.current?.emit("message_read", { chatId: decompressed.chatId });
                    useChatStore.getState().markChatAsRead(decompressed.chatId);
                }
            }
            if (!isFromMe) {
                const { soundEnabled } = useAuthStore.getState();
                if (soundEnabled) playReceiveSound();
            }
        };

        const handleMessageDelivered = ({ messageId, chatId }) => {
            useChatStore.getState().updateMessageStatus(chatId, messageId, "delivered");
        };

        const handleMessagesRead = ({ chatId }) => {
            useChatStore.getState().markMessagesAsReadByOther(chatId);
        };

        const handleTypingStatus = ({ userId, chatId, isTyping, scramble }) => {
            useChatStore.getState().setTypingUser(chatId, userId, isTyping, scramble);
            if (isTyping) {
                useChatStore.getState().setUserOnline(userId);
                useChatStore.getState().updateParticipantStatus(userId, true, null);
            }
        };

        const handleVoiceRecordingStatus = ({ userId, chatId, isRecording }) => {
            useChatStore.getState().setVoiceRecordingUser(chatId, userId, isRecording);
            if (isRecording) {
                useChatStore.getState().setUserOnline(userId);
                useChatStore.getState().updateParticipantStatus(userId, true, null);
            }
        };

        const handleUserOnline = ({ userId }) => {
            useChatStore.getState().setUserOnline(userId);
            useChatStore.getState().updateParticipantStatus(userId, true, null);
        };

        const handleUserOffline = ({ userId, lastSeen }) => {
            useChatStore.getState().setUserOffline(userId);
            useChatStore.getState().updateParticipantStatus(userId, false, lastSeen);
        };

        const handleUserZenStatus = ({ userId, isZenMode }) => {
            useChatStore.getState().setUserZenStatus(userId, isZenMode);
        };

        const handlePeerLowBandwidth = ({ userId, isLowBandwidth }) => {
            useChatStore.getState().setPeerLowBandwidth(userId, isLowBandwidth);
        };

        const handleMessageEdited = async ({ message }) => {
            const raw = isBinaryPacket(message) ? unpackMessage(message) : message;
            const decompressed = decompressPacket(raw);
            await decryptMessageIfNeeded(decompressed);
            useChatStore.getState().updateMessage(decompressed.chatId, decompressed);
        };

        const handleMessageReactionUpdated = ({ chatId, _id, reactions }) => {
            useChatStore.getState().updateMessage(chatId, { _id, reactions });
        };

        const handleMessageDeleted = ({ messageId, chatId, deleteFor }) => {
            useChatStore.getState().deleteMessage(chatId, messageId, deleteFor);
        };

        const handleNewChat = ({ chat }) => {
            useChatStore.getState().addChat(chat);
        };

        const handleChatDeleted = ({ chatId }) => {
            useChatStore.getState().removeChat(chatId);
        };

        const handleChatUpdated = ({ chatId, disappearingMode }) => {
            useChatStore.getState().updateChat(chatId, { disappearingMode });
        };

        const handleInstantMessagesDeleted = ({ chatId }) => {
            const store = useChatStore.getState();
            store.deleteInstantMessages(chatId);
            store.fetchChats();
            if (store.activeChat?._id === chatId) {
                store.fetchMessages(chatId);
            }
        };



        const handleNewMoment = (payload) => {
            const m = payload?.moment || payload;
            if (m && m._id) {
                useMomentStore.getState().addMoment(m);
            }
        };

        const handleMomentDeleted = (payload) => {
            const momentId = payload?.momentId || payload?._id || payload?.id || (typeof payload === 'string' ? payload : null);
            if (momentId) {
                useMomentStore.getState().removeMoment(momentId);
            }
        };

        const handleUserBlocked = ({ blockerId, blockedId }) => {
            const me = useAuthStore.getState().user;
            if (me && (me._id === blockerId || me._id === blockedId)) {
                useChatStore.getState().fetchChats();
                const activeChat = useChatStore.getState().activeChat;
                if (activeChat && !activeChat.isGroup) {
                    const peer = activeChat.participants.find(p => p._id.toString() !== me._id.toString());
                    const peerId = peer?._id || peer;
                    if (peerId?.toString() === blockerId || peerId?.toString() === blockedId) {
                        useChatStore.getState().fetchActiveChat(activeChat._id);
                    }
                }
            }
        };

        const handleUserUnblocked = ({ blockerId, blockedId }) => {
            const me = useAuthStore.getState().user;
            if (me && (me._id === blockerId || me._id === blockedId)) {
                useChatStore.getState().fetchChats();
                const activeChat = useChatStore.getState().activeChat;
                if (activeChat && !activeChat.isGroup) {
                    const peer = activeChat.participants.find(p => p._id.toString() !== me._id.toString());
                    const peerId = peer?._id || peer;
                    if (peerId?.toString() === blockerId || peerId?.toString() === blockedId) {
                        useChatStore.getState().fetchActiveChat(activeChat._id);
                    }
                }
            }
        };

        const handleZenReceiveInvite = ({ chatId, senderId }) => {
            const isCurrentlyInZenMode = useChatStore.getState().isZenMode;
            if (isCurrentlyInZenMode) {
                // Auto-reject because user is already busy in a ZenMode session
                if (socketRef.current) {
                    const currentUser = useAuthStore.getState().user;
                    socketRef.current.emit("zen_invite_respond", { 
                        chatId, 
                        responderId: userId, 
                        requesterId: senderId, 
                        accepted: false,
                        reason: "busy",
                        responderName: currentUser?.username || "The user"
                    });
                }
                return;
            }

            // Find target chat to get sender's username
            const targetChat = useChatStore.getState().chats.find(
                (c) => c._id?.toString() === chatId?.toString()
            );
            const otherParticipant = targetChat?.participants?.find(
                (p) => (p._id || p)?.toString() === senderId?.toString()
            );
            const senderName = otherParticipant?.username || "Someone";

            clearZenTimers();
            setIncomingZenInvite({ chatId, senderId, senderName });
            
            let remaining = 18;
            setZenCountdown(remaining);
            zenCountdownIntervalRef.current = setInterval(() => {
                remaining -= 1;
                if (remaining >= 0) {
                    setZenCountdown(remaining);
                }
            }, 1000);

            zenWaitingTimeoutRef.current = setTimeout(() => {
                clearZenTimers();
                setIncomingZenInvite(null);
            }, 18000);
        };

        const handleZenInviteResult = ({ chatId, responderId, requesterId, accepted, reason, responderName }) => {
            clearZenTimers();
            setIncomingZenInvite(null);

            if (accepted) {
                setZenWaitingState(null);
                try {
                    const audioCtx = getAudioContext();
                    if (audioCtx && audioCtx.state === "suspended") {
                        audioCtx.resume();
                    }
                } catch (err) {}
                showZenToast("success", "Connected in #ZenMode");

                // Set the current chat's Zen Mode state to true if matched
                const activeChat = useChatStore.getState().activeChat;
                if (activeChat && activeChat._id === chatId) {
                    useChatStore.getState().setZenModeState(true);
                }
            } else {
                if (userId === requesterId) {
                    if (reason === "busy") {
                        const nameToDisplay = responderName || "The user";
                        showZenToast("error", `${nameToDisplay} is currently in #ZenMode with another user. Kindly try after some time.`);
                        setZenWaitingState(null);
                    } else {
                        if (responderId === requesterId) {
                            setZenWaitingState("cancelled");
                        } else {
                            setZenWaitingState("refused");
                        }
                        setTimeout(() => {
                            setZenWaitingState(null);
                        }, 3000);
                    }
                } else {
                    // This is User B receiving User A's early cancellation
                    if (responderId === requesterId) {
                        setIncomingZenInvite(null);
                    }
                }
            }
        };

        const handleZenReceiveExitRequest = ({ chatId, senderId }) => {
            const targetChat = useChatStore.getState().chats.find(
                (c) => c._id?.toString() === chatId?.toString()
            );
            const otherParticipant = targetChat?.participants?.find(
                (p) => (p._id || p)?.toString() === senderId?.toString()
            );
            const senderName = otherParticipant?.username || "Someone";

            clearZenTimers();
            setIncomingZenExit({ chatId, senderId, senderName });

            let remaining = 18;
            setZenCountdown(remaining);
            zenCountdownIntervalRef.current = setInterval(() => {
                remaining -= 1;
                if (remaining >= 0) {
                    setZenCountdown(remaining);
                }
            }, 1000);

            zenWaitingTimeoutRef.current = setTimeout(() => {
                clearZenTimers();
                setIncomingZenExit(null);
            }, 18000);
        };

        const handleZenExitResult = ({ chatId, responderId, requesterId, accepted }) => {
            clearZenTimers();
            setIncomingZenExit(null);
            zenExitTimeoutCountRef.current = 0;

            if (accepted) {
                setZenWaitingState(null);
                showZenToast("success", "Ended #ZenMode session");

                // Sync store isZenMode to false
                useChatStore.getState().setZenModeState(false);
            } else {
                if (userId === requesterId) {
                    setZenWaitingState("exit-refused");
                    setTimeout(() => setZenWaitingState(null), 3000);
                }
            }
        };

        const handleForceLogout = () => {
            useAuthStore.getState().logout();
            window.location.href = "/login";
        };



        socket.on("connect", async () => {
            setIsConnected(true);
            const chatStore = useChatStore.getState();
            // Don't wipe presence immediately — wait for online_users reconciliation
            // so there's no flash of "everyone offline" during reconnect

            socket.emit("zen_mode_status", { isZenMode: chatStore.isZenMode });

            // Emit active status immediately on connect
            const isActive = document.visibilityState === "visible";
            socket.emit("set_active_status", { isActive });

            const activeChat = chatStore.activeChat;
            const isLowBandwidth = chatStore.isLowBandwidth;

            socket.emit("update_low_bandwidth", { chatId: activeChat?._id || "", isLowBandwidth });

            if (activeChat?._id) {
                socket.emit("join_chat", { chatId: activeChat._id, isLowBandwidth });
                chatStore.fetchMessages(activeChat._id);
            }
            chatStore.fetchChats();
            setTimeout(() => {
                flushOutboxRef.current?.();
                flushMediaOutboxRef.current?.();
            }, 300);
        });

        socket.on("disconnect", () => {
            setIsConnected(false);
            // Keep stale presence during the server's 5s grace period
            // so users don't flash offline on slow device reloads
        });

        socket.on("online_users", ({ userIds }) => {
            if (Array.isArray(userIds)) {
                // Mark confirmed-online users
                userIds.forEach(id => {
                    useChatStore.getState().setUserOnline(id);
                    useChatStore.getState().updateParticipantStatus(id, true, null);
                });
                // Reconcile: mark anyone NOT in the list as offline
                // (clears stale presence from before reconnect)
                if (pendingOnlineReconcileRef.current) {
                    clearTimeout(pendingOnlineReconcileRef.current);
                }
                pendingOnlineReconcileRef.current = setTimeout(() => {
                    const store = useChatStore.getState();
                    const knownOnline = store.onlineUsers;
                    const confirmedSet = new Set(userIds.map(String));
                    knownOnline.forEach(id => {
                        if (!confirmedSet.has(String(id))) {
                            store.setUserOffline(id);
                            store.updateParticipantStatus(id, false, null);
                        }
                    });
                }, 500);
            }
        });

        socket.on("receive_message", handleReceiveMessage);
        socket.on("message_delivered", handleMessageDelivered);
        socket.on("messages_read", handleMessagesRead);
        socket.on("typing_status", handleTypingStatus);
        socket.on("voice_recording_status", handleVoiceRecordingStatus);
        socket.on("user_online", handleUserOnline);
        socket.on("user_offline", handleUserOffline);
        socket.on("user_zen_status", handleUserZenStatus);
        socket.on("peer_low_bandwidth", handlePeerLowBandwidth);
        socket.on("message_edited", handleMessageEdited);
        socket.on("message_reaction_updated", handleMessageReactionUpdated);
        socket.on("message_deleted", handleMessageDeleted);
        socket.on("new_chat", handleNewChat);
        socket.on("chat_deleted", handleChatDeleted);
        socket.on("chat_updated", handleChatUpdated);
        socket.on("instant_messages_deleted", handleInstantMessagesDeleted);
        socket.on("new_moment", handleNewMoment);
        socket.on("moment_deleted", handleMomentDeleted);
        socket.on("moment_liked", ({ momentId, likes }) => {
            useMomentStore.getState().updateMomentLikes(momentId, likes);
        });
        socket.on("zen_messages_cleared", ({ chatId }) => {
            useChatStore.getState().purgeZenMessages(chatId);
        });
        socket.on("user_blocked", handleUserBlocked);
        socket.on("user_unblocked", handleUserUnblocked);
        socket.on("force_logout", handleForceLogout);

        socket.on("zen_receive_invite", handleZenReceiveInvite);
        socket.on("zen_invite_result", handleZenInviteResult);
        socket.on("zen_receive_exit_request", handleZenReceiveExitRequest);
        socket.on("zen_exit_result", handleZenExitResult);
        socket.on("zen_exit_cancel_receive", () => {
            clearZenTimers();
            setIncomingZenExit(null);
            setShowExitConfirm(false);
        });

        // Page Visibility: emit set_active_status when tab/app goes to background or returns
        let lastActiveState = null;
        let lastActiveEmit = 0;
        
        const emitActiveStatus = (isActive) => {
            if (!socketRef.current?.connected) return;
            if (lastActiveState === isActive && isActive) {
                const now = Date.now();
                if (now - lastActiveEmit < 10000) return;
            }
            lastActiveState = isActive;
            lastActiveEmit = Date.now();
            socketRef.current.emit("set_active_status", { isActive });
        };

        const handleVisibilityChange = () => {
            emitActiveStatus(document.visibilityState === "visible");
        };
        
        const handleUserActivity = () => {
            if (document.visibilityState === "visible") {
                emitActiveStatus(true);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleUserActivity);
        window.addEventListener("touchstart", handleUserActivity);

        const handlePageHide = () => {
            if (!socketRef.current?.connected) return;
            socketRef.current.emit("set_active_status", { isActive: false });
        };

        window.addEventListener("pagehide", handlePageHide);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleUserActivity);
            window.removeEventListener("touchstart", handleUserActivity);
            window.removeEventListener("pagehide", handlePageHide);
            socket.off("connect");
            socket.off("disconnect");
            socket.off("receive_message", handleReceiveMessage);
            socket.off("message_delivered", handleMessageDelivered);
            socket.off("messages_read", handleMessagesRead);
            socket.off("typing_status", handleTypingStatus);
            socket.off("voice_recording_status", handleVoiceRecordingStatus);
            socket.off("user_online", handleUserOnline);
            socket.off("user_offline", handleUserOffline);
            socket.off("user_zen_status", handleUserZenStatus);
            socket.off("peer_low_bandwidth", handlePeerLowBandwidth);
            socket.off("message_edited", handleMessageEdited);
            socket.off("message_reaction_updated", handleMessageReactionUpdated);
            socket.off("message_deleted", handleMessageDeleted);
            socket.off("new_chat", handleNewChat);
            socket.off("chat_deleted", handleChatDeleted);
            socket.off("chat_updated", handleChatUpdated);
            socket.off("instant_messages_deleted", handleInstantMessagesDeleted);
            socket.off("new_moment", handleNewMoment);
            socket.off("moment_deleted", handleMomentDeleted);
            socket.off("moment_liked");
            socket.off("zen_messages_cleared");
            socket.off("user_blocked", handleUserBlocked);
            socket.off("user_unblocked", handleUserUnblocked);
            socket.off("force_logout", handleForceLogout);

            socket.off("zen_receive_invite", handleZenReceiveInvite);
            socket.off("zen_invite_result", handleZenInviteResult);
            socket.off("zen_receive_exit_request", handleZenReceiveExitRequest);
            socket.off("zen_exit_result", handleZenExitResult);
            socket.off("zen_exit_cancel_receive");

            socket.disconnect();
            socketRef.current = null;
        };
    }, [token, userId]);

    const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);

    useEffect(() => {
        if (socketRef.current?.connected) {
            const activeChat = useChatStore.getState().activeChat;
            socketRef.current.emit("update_low_bandwidth", {
                chatId: activeChat?._id || "",
                isLowBandwidth
            });
        }
    }, [isLowBandwidth]);

    const joinChat = useCallback((chatId) => {
        const isLowBandwidth = useChatStore.getState().isLowBandwidth;
        socketRef.current?.emit("join_chat", { chatId, isLowBandwidth });
    }, []);

    const updateLowBandwidth = useCallback((chatId, isLowBandwidth) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("update_low_bandwidth", { chatId, isLowBandwidth });
        }
    }, []);

    const leaveChat = useCallback((chatId) => {
        socketRef.current?.emit("leave_chat", { chatId });
    }, []);

    const isFlushingRef = useRef(false);
    const flushOutbox = useCallback(async () => {
        if (isFlushingRef.current) return;
        
        const hasInternet = typeof navigator !== "undefined" ? navigator.onLine : true;
        if (!hasInternet) return;
        
        isFlushingRef.current = true;
        try {
            const queued = await drainOutbox();
            if (!queued || queued.length === 0) return;
            
            const processedQueue = [];
            for (const item of queued) {
                const { id: _id, createdAt: _ts, ...payload } = item;
                if (payload.content && payload.type === "text" && !payload.isEncrypted) {
                    try {
                        const activeChat = useChatStore.getState().chats.find(c => c._id?.toString() === payload.chatId?.toString()) || useChatStore.getState().activeChat;
                        const currentUserId = useAuthStore.getState().user?._id;
                        const otherParticipant = activeChat?.participants?.find(p => (p._id || p) !== currentUserId);
                        const otherParticipantId = otherParticipant?._id || otherParticipant;

                        if (otherParticipantId && currentUserId) {
                            const [recKey, sndKey] = await Promise.all([
                                getCachedPublicKey(otherParticipantId),
                                getCachedPublicKey(currentUserId)
                            ]);

                            if (recKey && sndKey) {
                                const encrypted = await encryptMessageContentForBoth(
                                    payload.content,
                                    recKey,
                                    sndKey
                                );
                                payload.content = encrypted.ciphertext;
                                payload.encryptedSymmetricKey = JSON.stringify({
                                    [otherParticipantId]: encrypted.encryptedSymmetricKeyRec,
                                    [currentUserId]: encrypted.encryptedSymmetricKeySnd
                                });
                                payload.iv = encrypted.iv;
                                payload.isEncrypted = true;
                            }
                        }
                    } catch (err) {
                        console.error("[SocketContext] E2EE encryption-on-flush skipped/failed:", err);
                    }
                }
                processedQueue.push(payload);
            }
            
            if (socketRef.current?.connected) {
                for (const payload of processedQueue) {
                    const binaryPayload = { ...payload };
                    if (payload.isEncrypted) {
                        binaryPayload.content = hexToBytes(payload.content);
                        binaryPayload.iv = hexToBytes(payload.iv);
                    }
                    const compressed = compressPacket(binaryPayload);
                    const packed = packMessage(compressed);
                    socketRef.current.emit("send_message", packed);
                }
            } else {
                try {
                    const { data } = await axiosInstance.post("/chats/offline-sync", { messages: processedQueue });
                    console.log("[SocketContext] REST offline outbox sync completed successfully:", data);
                } catch (restErr) {
                    console.error("[SocketContext] REST offline sync failed, re-queueing to outbox:", restErr);
                    for (const payload of processedQueue) {
                        await enqueueOutbox(payload);
                    }
                }
            }
        } finally {
            isFlushingRef.current = false;
        }
    }, []);

    const flushOutboxRef = useRef(null);
    const flushMediaOutboxRef = useRef(null);
    useEffect(() => { flushOutboxRef.current = flushOutbox; }, [flushOutbox]);

    const flushMediaOutbox = useCallback(async () => {
        if (!socketRef.current?.connected) return;
        const pending = await drainPendingMedia();
        if (!pending.length) return;
        for (const item of pending) {
            try {
                const { id: _id, createdAt: _ts, base64, fileName, fileType, uploadType, chatId, textContent, replyTo, isViewOnce, cid, isZenMessage, isLowBandwidth, lqip } = item;
                const byteString = atob(base64);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                const blob = new Blob([ab], { type: fileType });
                const file = new File([blob], fileName, { type: fileType });

                const formData = new FormData();
                formData.append("file", file);
                formData.append("upload_preset", "ml_default");

                const res = await fetch(
                    `https://api.cloudinary.com/v1_1/du4nvei7j/${uploadType}/upload`,
                    { method: "POST", body: formData }
                );
                const data = await res.json();
                if (!data.secure_url) throw new Error("Upload failed");

                const msgType = item.msgType || (uploadType === "video" ? "video" : uploadType === "raw" ? "file" : "image");
                socketRef.current.emit("send_message", {
                    chatId, content: textContent || "", type: msgType,
                    mediaUrl: data.secure_url, replyTo, isViewOnce,
                    cid, isLowBandwidth, isZenMessage, waveform: item.waveform || "",
                    lqip: lqip || ""
                });
            } catch (err) {
                console.error("[SocketContext] flushMediaOutbox item failed:", err);
            }
        }
    }, []);

    useEffect(() => { flushMediaOutboxRef.current = flushMediaOutbox; }, [flushMediaOutbox]);

    useEffect(() => {
        const handleOnline = () => {
            flushOutbox();
            flushMediaOutbox();
        };
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [flushOutbox, flushMediaOutbox]);

    // -- Active Time Tracker --
    const activeTimeAccumulatorRef = useRef({ lastAction: 0, accumulatedSeconds: 0, contactId: null });
    
    const trackActiveTime = useCallback((chatId) => {
        if (!chatId) return;
        const now = Date.now();
        const state = activeTimeAccumulatorRef.current;
        
        // Find contactId from chatId
        let contactId = null;
        const activeChat = useChatStore.getState().chats.find(c => c._id === chatId);
        if (activeChat && !activeChat.isGroup) {
            const currentUserId = useAuthStore.getState().user?._id;
            const peer = activeChat.participants.find(p => (p._id || p) !== currentUserId);
            contactId = peer?._id || peer;
        }

        // Prevent rapid firing (e.g. keypresses) - only count if > 1s since last action
        if (now - state.lastAction > 1000) {
            // If they are active continuously, just add 1 second (this is an approximation for "was active in this second")
            // Actually, a better approach: if action is within 30s of last action, we consider the whole time as "active".
            // But to avoid complex intervals, just adding a fixed "2 seconds" per action up to a max per minute works.
            
            // Simpler approach:
            // Every action grants 5 seconds of "active time".
            state.accumulatedSeconds += 5;
            state.lastAction = now;
            state.contactId = contactId;

            if (state.accumulatedSeconds >= 60) {
                if (socketRef.current?.connected) {
                    socketRef.current.emit("update_active_time", {
                        additionalMinutes: 1,
                        contactId: state.contactId
                    });
                }
                state.accumulatedSeconds = 0; // Reset
            }
        }
    }, []);

    const sendMessage = useCallback(async (chatId, content, type = "text", mediaUrl = "", replyTo = null, isViewOnce = false, cid = null, isZenMessage = false, waveform = "", replyToMoment = null, replyToMomentUsername = "", lqip = "") => {
        trackActiveTime(chatId);
        
        const isLowBandwidth = useChatStore.getState().isLowBandwidth;
        let payload = { chatId, content, type, mediaUrl, replyTo, isViewOnce, cid, isLowBandwidth, isZenMessage, waveform, replyToMoment, replyToMomentUsername, lqip };


        // Transparent E2EE Message Encryption
        if (content && type === "text") {
            try {
                const activeChat = useChatStore.getState().activeChat;
                const currentUserId = useAuthStore.getState().user?._id;
                const otherParticipant = activeChat?.participants?.find(p => (p._id || p) !== currentUserId);
                const otherParticipantId = otherParticipant?._id || otherParticipant;

                if (otherParticipantId && currentUserId) {
                    const [recKey, sndKey] = await Promise.all([
                        getCachedPublicKey(otherParticipantId),
                        getCachedPublicKey(currentUserId)
                    ]);

                    if (recKey && sndKey) {
                        const encrypted = await encryptMessageContentForBoth(
                            content,
                            recKey,
                            sndKey
                        );
                        payload.content = encrypted.ciphertext;
                        payload.encryptedSymmetricKey = JSON.stringify({
                            [otherParticipantId]: encrypted.encryptedSymmetricKeyRec,
                            [currentUserId]: encrypted.encryptedSymmetricKeySnd
                        });
                        payload.iv = encrypted.iv;
                        payload.isEncrypted = true;
                    }
                }
            } catch (err) {
                console.error("[SocketContext] Sender E2EE Encryption skipped/failed:", err);
            }
        }

        if (socketRef.current?.connected) {
            const binaryPayload = { ...payload };
            if (payload.isEncrypted) {
                binaryPayload.content = hexToBytes(payload.content);
                binaryPayload.iv = hexToBytes(payload.iv);
            }
            const compressed = compressPacket(binaryPayload);
            const packed = packMessage(compressed);
            socketRef.current.emit("send_message", packed);
        } else {
            enqueueOutbox(payload);
            try {
                if ('serviceWorker' in navigator && 'SyncManager' in window) {
                    navigator.serviceWorker.ready.then((registration) => {
                        registration.sync.register('sync-zenchat-messages').catch(() => {});
                    });
                }
            } catch (_) {}
        }
    }, [trackActiveTime]);

    const startTyping = useCallback((chatId, scramble) => {
        trackActiveTime(chatId);
        if (socketRef.current?.connected) {
            socketRef.current.emit("typing_start", { chatId, scramble });
        }
    }, [trackActiveTime]);

    const stopTyping = useCallback((chatId) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("typing_stop", { chatId });
        }
    }, []);

    const markAsRead = useCallback((chatId) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("message_read", { chatId });
        }
    }, []);

    const reactToMessage = useCallback((chatId, messageId, emoji) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("message_react", { chatId, messageId, emoji });
        }
    }, []);

    const editMessage = useCallback(async (chatId, messageId, newContent) => {
        if (socketRef.current?.connected) {
            const messages = useChatStore.getState().messages;
            const chatMessages = messages[chatId] || [];
            const originalMsg = chatMessages.find(m => m._id === messageId);
            
            let payload = { chatId, messageId, newContent };
            
            if (originalMsg && originalMsg.isEncrypted) {
                try {
                    const currentUserId = useAuthStore.getState().user?._id;
                    const activeChat = useChatStore.getState().activeChat;
                    const otherParticipant = activeChat?.participants?.find(p => (p._id || p) !== currentUserId);
                    const otherParticipantId = otherParticipant?._id || otherParticipant;

                    if (otherParticipantId && currentUserId) {
                        const [recKey, sndKey] = await Promise.all([
                            getCachedPublicKey(otherParticipantId),
                            getCachedPublicKey(currentUserId)
                        ]);

                        if (recKey && sndKey) {
                            const encrypted = await encryptMessageContentForBoth(
                                newContent,
                                recKey,
                                sndKey
                            );
                            
                            payload.encryptedContent = encrypted.ciphertext;
                            payload.encryptedSymmetricKey = JSON.stringify({
                                [otherParticipantId]: encrypted.encryptedSymmetricKeyRec,
                                [currentUserId]: encrypted.encryptedSymmetricKeySnd
                            });
                            payload.iv = encrypted.iv;
                            payload.isEncrypted = true;
                        }
                    }
                } catch (err) {
                    console.error("[SocketContext] E2EE Edit Encryption failed:", err);
                }
            }

            socketRef.current.emit("edit_message", payload);
        }
    }, []);

    const deleteMessage = useCallback((chatId, messageId, deleteFor = "everyone") => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("delete_message", { chatId, messageId, deleteFor });
        }
    }, []);

     const socketValue = useMemo(() => ({
        socket: socketRef.current,
        isConnected,
        joinChat,
        leaveChat,
        sendMessage,
        startTyping,
        stopTyping,
        markAsRead,
        editMessage,
        deleteMessage,
        reactToMessage,
        updateLowBandwidth,
        isOnline: navigator.onLine,

        // Expose Zen states and control helpers globally
        incomingZenInvite,
        setIncomingZenInvite,
        incomingZenExit,
        setIncomingZenExit,
        zenWaitingState,
        setZenWaitingState,
        zenCountdown,
        setZenCountdown,
        zenToast,
        setZenToast,
        clearZenTimers,
        showZenToast,
        startZenTimer,
        zenExitTimeoutCountRef,
        showExitConfirm,
        setShowExitConfirm
    }), [
        isConnected, joinChat, leaveChat, sendMessage, startTyping, stopTyping, markAsRead, editMessage, deleteMessage, reactToMessage, updateLowBandwidth,
        incomingZenInvite, incomingZenExit, zenWaitingState, zenCountdown, zenToast, clearZenTimers, showZenToast, startZenTimer, showExitConfirm
    ]);

    return (
        <SocketContext.Provider value={socketValue}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);