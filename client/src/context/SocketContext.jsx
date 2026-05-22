import { createContext, useContext, useEffect, useRef, useCallback, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { playReceiveSound } from "../utils/audio";
import { useMomentStore } from "../stores/momentStore";
import { enqueueOutbox, drainOutbox, drainPendingMedia } from "../db/zenDB";
import { decryptMessageIfNeeded } from "../utils/e2eeHelper";
import { encryptMessageContent, encryptMessageContentForBoth } from "../utils/crypto";
import axiosInstance from "../utils/axios";
import { decompressPacket } from "../utils/packetCompressor";



const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const userId = useAuthStore((state) => state.user?._id);
    const token = useAuthStore((state) => state.token);

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
            const decompressed = decompressPacket(message);
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
                socketRef.current?.emit("message_read", { chatId: decompressed.chatId });
                useChatStore.getState().markChatAsRead(decompressed.chatId);
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

        const handleMessageEdited = ({ message }) => {
            useChatStore.getState().updateMessage(message.chatId, message);
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

        const handleForceLogout = () => {
            useAuthStore.getState().logout();
            window.location.href = "/login";
        };

        socket.on("connect", async () => {
            setIsConnected(true);
            const chatStore = useChatStore.getState();
            chatStore.clearOnlinePresence();
            
            const activeChat = chatStore.activeChat;
            const isLowBandwidth = chatStore.isLowBandwidth;
            
            socket.emit("update_low_bandwidth", { chatId: activeChat?._id || "", isLowBandwidth });
            
            if (activeChat?._id) {
                socket.emit("join_chat", { chatId: activeChat._id, isLowBandwidth });
                chatStore.fetchMessages(activeChat._id);
            }
            chatStore.fetchChats();
            // Use flushOutbox so E2EE re-encryption is applied to queued messages
            setTimeout(() => {
                flushOutboxRef.current?.();
                flushMediaOutboxRef.current?.();
            }, 300);
        });

        socket.on("disconnect", () => {
            setIsConnected(false);
            useChatStore.getState().clearOnlinePresence();
        });

        socket.on("online_users", ({ userIds }) => {
            if (Array.isArray(userIds)) {
                userIds.forEach(id => {
                    useChatStore.getState().setUserOnline(id);
                    useChatStore.getState().updateParticipantStatus(id, true, null);
                });
            }
        });

        socket.on("receive_message", handleReceiveMessage);
        socket.on("message_delivered", handleMessageDelivered);
        socket.on("messages_read", handleMessagesRead);
        socket.on("typing_status", handleTypingStatus);
        socket.on("user_online", handleUserOnline);
        socket.on("user_offline", handleUserOffline);
        socket.on("user_zen_status", handleUserZenStatus);
        socket.on("peer_low_bandwidth", handlePeerLowBandwidth);
        socket.on("message_edited", handleMessageEdited);
        socket.on("message_deleted", handleMessageDeleted);
        socket.on("new_chat", handleNewChat);
        socket.on("chat_deleted", handleChatDeleted);
        socket.on("chat_updated", handleChatUpdated);
        socket.on("instant_messages_deleted", handleInstantMessagesDeleted);
        socket.on("new_moment", handleNewMoment);
        socket.on("moment_deleted", handleMomentDeleted);
        socket.on("zen_messages_cleared", ({ chatId }) => {
            useChatStore.getState().purgeZenMessages(chatId);
        });
        socket.on("user_blocked", handleUserBlocked);
        socket.on("user_unblocked", handleUserUnblocked);
        socket.on("force_logout", handleForceLogout);

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("receive_message", handleReceiveMessage);
            socket.off("message_delivered", handleMessageDelivered);
            socket.off("messages_read", handleMessagesRead);
            socket.off("typing_status", handleTypingStatus);
            socket.off("user_online", handleUserOnline);
            socket.off("user_offline", handleUserOffline);
            socket.off("user_zen_status", handleUserZenStatus);
            socket.off("peer_low_bandwidth", handlePeerLowBandwidth);
            socket.off("message_edited", handleMessageEdited);
            socket.off("message_deleted", handleMessageDeleted);
            socket.off("new_chat", handleNewChat);
            socket.off("chat_deleted", handleChatDeleted);
            socket.off("chat_updated", handleChatUpdated);
            socket.off("instant_messages_deleted", handleInstantMessagesDeleted);
            socket.off("new_moment", handleNewMoment);
            socket.off("moment_deleted", handleMomentDeleted);
            socket.off("zen_messages_cleared");
            socket.off("user_blocked", handleUserBlocked);
            socket.off("user_unblocked", handleUserUnblocked);
            socket.off("force_logout", handleForceLogout);
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
        if (!socketRef.current?.connected || isFlushingRef.current) return;
        isFlushingRef.current = true;
        try {
            const queued = await drainOutbox();
            for (const item of queued) {
                const { id: _id, createdAt: _ts, ...payload } = item;
                if (payload.content && payload.type === "text" && !payload.isEncrypted) {
                    try {
                        const activeChat = useChatStore.getState().chats.find(c => c._id?.toString() === payload.chatId?.toString()) || useChatStore.getState().activeChat;
                        const currentUserId = useAuthStore.getState().user?._id;
                        const otherParticipant = activeChat?.participants?.find(p => (p._id || p) !== currentUserId);
                        const otherParticipantId = otherParticipant?._id || otherParticipant;

                        if (otherParticipantId && currentUserId) {
                            const [recRes, sndRes] = await Promise.all([
                                axiosInstance.get(`/auth/users/${otherParticipantId}/public-key`),
                                axiosInstance.get(`/auth/users/${currentUserId}/public-key`)
                            ]);

                            if (recRes.data?.publicKey && sndRes.data?.publicKey) {
                                const encrypted = await encryptMessageContentForBoth(
                                    payload.content,
                                    recRes.data.publicKey,
                                    sndRes.data.publicKey
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
                socketRef.current.emit("send_message", payload);
            }
        } finally {
            isFlushingRef.current = false;
        }
    }, []);

    const flushOutboxRef = useRef(null);
    const flushMediaOutboxRef = useRef(null);
    useEffect(() => { flushOutboxRef.current = flushOutbox; }, [flushOutbox]);

    const flushMediaOutbox = useCallback(async () => {
        if (!socketRef.current?.connected || !navigator.onLine) return;
        const pending = await drainPendingMedia();
        if (!pending.length) return;
        for (const item of pending) {
            try {
                const { id: _id, createdAt: _ts, base64, fileName, fileType, uploadType, chatId, textContent, replyTo, isViewOnce, cid, isZenMessage, isLowBandwidth } = item;
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

                const msgType = uploadType === "video" ? "video" : uploadType === "raw" ? "file" : "image";
                socketRef.current.emit("send_message", {
                    chatId, content: textContent || "", type: msgType,
                    mediaUrl: data.secure_url, replyTo, isViewOnce,
                    cid, isLowBandwidth, isZenMessage
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

    const sendMessage = useCallback(async (chatId, content, type = "text", mediaUrl = "", replyTo = null, isViewOnce = false, cid = null, isZenMessage = false) => {
        const isLowBandwidth = useChatStore.getState().isLowBandwidth;
        let payload = { chatId, content, type, mediaUrl, replyTo, isViewOnce, cid, isLowBandwidth, isZenMessage };

        // Transparent E2EE Message Encryption
        if (content && type === "text") {
            try {
                const activeChat = useChatStore.getState().activeChat;
                const currentUserId = useAuthStore.getState().user?._id;
                const otherParticipant = activeChat?.participants?.find(p => (p._id || p) !== currentUserId);
                const otherParticipantId = otherParticipant?._id || otherParticipant;

                if (otherParticipantId && currentUserId) {
                    const [recRes, sndRes] = await Promise.all([
                        axiosInstance.get(`/auth/users/${otherParticipantId}/public-key`),
                        axiosInstance.get(`/auth/users/${currentUserId}/public-key`)
                    ]);

                    if (recRes.data?.publicKey && sndRes.data?.publicKey) {
                        const encrypted = await encryptMessageContentForBoth(
                            content,
                            recRes.data.publicKey,
                            sndRes.data.publicKey
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

        if (socketRef.current?.connected && navigator.onLine) {
            socketRef.current.emit("send_message", payload);
        } else {
            enqueueOutbox(payload);
        }
    }, []);

    const startTyping = useCallback((chatId, scramble) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("typing_start", { chatId, scramble });
        }
    }, []);

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
                        const [recRes, sndRes] = await Promise.all([
                            axiosInstance.get(`/auth/users/${otherParticipantId}/public-key`),
                            axiosInstance.get(`/auth/users/${currentUserId}/public-key`)
                        ]);

                        if (recRes.data?.publicKey && sndRes.data?.publicKey) {
                            const encrypted = await encryptMessageContentForBoth(
                                newContent,
                                recRes.data.publicKey,
                                sndRes.data.publicKey
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
        updateLowBandwidth,
        isOnline: navigator.onLine
    }), [isConnected, joinChat, leaveChat, sendMessage, startTyping, stopTyping, markAsRead, editMessage, deleteMessage, updateLowBandwidth]);

    return (
        <SocketContext.Provider value={socketValue}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);