import { createContext, useContext, useEffect, useRef, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { playReceiveSound } from "../utils/audio";
import { useMomentStore } from "../stores/momentStore";
import { enqueueOutbox, drainOutbox } from "../db/zenDB";
import { isEncrypted, encryptMessage, decryptMessage, getSharedKey } from "../utils/crypto";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const user = useAuthStore((state) => state.user);
    const token = useAuthStore((state) => state.token);

    useEffect(() => {
        if (!token || !user) return;

        const serverUrl = import.meta.env.VITE_API_URL || "/";
        const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

        socketRef.current = io(serverUrl, {
            auth: { 
                userId: user._id,
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
            if (message.mediaUrl) {
                message.mediaUrl = getThumbnailUrl(message.mediaUrl);
            }

            if (message.content && isEncrypted(message.content)) {
                const senderId = message.senderId?._id?.toString() || message.senderId?.toString();
                if (senderId) {
                    const aesKey = await getSharedKey(senderId);
                    if (aesKey) {
                        const plain = await decryptMessage(message.content, aesKey);
                        message.content = plain !== null ? plain : "🔒 Encrypted message";
                    } else {
                        message.content = "🔒 Encrypted message";
                    }
                    message.wasEncrypted = true;
                }
            }

            const existingChat = useChatStore.getState().chats.find(
                (c) => c._id?.toString() === message.chatId?.toString()
            );

            if (!existingChat) {
                await useChatStore.getState().fetchChats();
            }

            useChatStore.getState().addMessage(message.chatId, message);

            const activeChat = useChatStore.getState().activeChat;
            const currentUserId = useAuthStore.getState().user?._id;
            const isFromMe =
                message.senderId?.toString() === currentUserId?.toString() ||
                message.senderId?._id?.toString() === currentUserId?.toString();

            if (activeChat?._id?.toString() === message.chatId?.toString() && !isFromMe) {
                socketRef.current?.emit("message_read", { chatId: message.chatId });
                useChatStore.getState().markChatAsRead(message.chatId);
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

        const handleMessageEdited = ({ message }) => {
            useChatStore.getState().updateMessage(message.chatId, message);
        };

        const handleMessageDeleted = ({ messageId, chatId, deleteFor }) => {
            useChatStore.getState().deleteMessage(chatId, messageId, deleteFor);
        };

        const handleNewChat = ({ chat }) => {
            useChatStore.getState().addChat(chat);
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

        socket.on("connect", async () => {
            const activeChat = useChatStore.getState().activeChat;
            if (activeChat?._id) {
                socket.emit("join_chat", { chatId: activeChat._id });
                useChatStore.getState().fetchMessages(activeChat._id);
            }
            useChatStore.getState().fetchChats();
            const queued = await drainOutbox();
            queued.forEach(({ id: _id, createdAt: _ts, ...payload }) => {
                socket.emit("send_message", payload);
            });
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
        socket.on("message_edited", handleMessageEdited);
        socket.on("message_deleted", handleMessageDeleted);
        socket.on("new_chat", handleNewChat);
        socket.on("new_moment", handleNewMoment);
        socket.on("moment_deleted", handleMomentDeleted);

        return () => {
            socket.off("connect");
            socket.off("receive_message", handleReceiveMessage);
            socket.off("message_delivered", handleMessageDelivered);
            socket.off("messages_read", handleMessagesRead);
            socket.off("typing_status", handleTypingStatus);
            socket.off("user_online", handleUserOnline);
            socket.off("user_offline", handleUserOffline);
            socket.off("message_edited", handleMessageEdited);
            socket.off("message_deleted", handleMessageDeleted);
            socket.off("new_chat", handleNewChat);
            socket.off("new_moment", handleNewMoment);
            socket.off("moment_deleted", handleMomentDeleted);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token, user?._id]);

    const joinChat = useCallback((chatId) => {
        socketRef.current?.emit("join_chat", { chatId });
    }, []);

    const leaveChat = useCallback((chatId) => {
        socketRef.current?.emit("leave_chat", { chatId });
    }, []);

    const flushOutbox = useCallback(async () => {
        if (!socketRef.current?.connected) return;
        const queued = await drainOutbox();
        queued.forEach(({ id: _id, createdAt: _ts, ...payload }) => {
            socketRef.current.emit("send_message", payload);
        });
    }, []);

    useEffect(() => {
        const handleOnline = () => flushOutbox();
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [flushOutbox]);

    const sendMessage = useCallback(async (chatId, content, type = "text", mediaUrl = "", replyTo = null, isViewOnce = false, cid = null) => {
        let finalContent = content;
        if (type === "text" && content) {
            const activeChat = useChatStore.getState().activeChat;
            const currentUserId = useAuthStore.getState().user?._id;
            const peer = activeChat?.participants?.find(
                (p) => (p._id?.toString() || p.toString()) !== currentUserId?.toString()
            );
            const peerId = peer?._id?.toString() || peer?.toString();
            if (peerId) {
                const aesKey = await getSharedKey(peerId);
                if (aesKey) finalContent = await encryptMessage(content, aesKey);
            }
        }
        const payload = { chatId, content: finalContent, type, mediaUrl, replyTo, isViewOnce, cid };
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

    const editMessage = useCallback((chatId, messageId, newContent) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("edit_message", { chatId, messageId, newContent });
        }
    }, []);

    const deleteMessage = useCallback((chatId, messageId, deleteFor = "everyone") => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("delete_message", { chatId, messageId, deleteFor });
        }
    }, []);

    const socketValue = useMemo(() => ({
        socket: socketRef.current,
        joinChat,
        leaveChat,
        sendMessage,
        startTyping,
        stopTyping,
        markAsRead,
        editMessage,
        deleteMessage,
        isOnline: navigator.onLine
    }), [joinChat, leaveChat, sendMessage, startTyping, stopTyping, markAsRead, editMessage, deleteMessage]);

    return (
        <SocketContext.Provider value={socketValue}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);