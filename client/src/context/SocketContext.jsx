import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { playReceiveSound } from "../utils/audio";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const user = useAuthStore((state) => state.user);
    const token = useAuthStore((state) => state.token);

    useEffect(() => {
        if (!token || !user) return;

        const serverUrl = import.meta.env.VITE_API_URL || "/";
        socketRef.current = io(serverUrl, {
            auth: { userId: user._id },
            extraHeaders: { Authorization: `Bearer ${token}` },
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            transports: ["websocket", "polling"],
        });

        const socket = socketRef.current;

        const handleReceiveMessage = ({ message }) => {
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
                playReceiveSound();
            }
        };

        const handleMessageDelivered = ({ messageId, chatId }) => {
            useChatStore.getState().updateMessageStatus(chatId, messageId, "delivered");
        };

        const handleMessagesRead = ({ chatId }) => {
            useChatStore.getState().markMessagesAsReadByOther(chatId);
        };

        const handleTypingStatus = ({ userId, chatId, isTyping }) => {
            useChatStore.getState().setTypingUser(chatId, userId, isTyping);
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

        socket.on("receive_message", handleReceiveMessage);
        socket.on("message_delivered", handleMessageDelivered);
        socket.on("messages_read", handleMessagesRead);
        socket.on("typing_status", handleTypingStatus);
        socket.on("user_online", handleUserOnline);
        socket.on("user_offline", handleUserOffline);
        socket.on("message_edited", handleMessageEdited);
        socket.on("message_deleted", handleMessageDeleted);

        return () => {
            socket.off("receive_message", handleReceiveMessage);
            socket.off("message_delivered", handleMessageDelivered);
            socket.off("messages_read", handleMessagesRead);
            socket.off("typing_status", handleTypingStatus);
            socket.off("user_online", handleUserOnline);
            socket.off("user_offline", handleUserOffline);
            socket.off("message_edited", handleMessageEdited);
            socket.off("message_deleted", handleMessageDeleted);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token, user]);

    const joinChat = useCallback((chatId) => {
        socketRef.current?.emit("join_chat", { chatId });
    }, []);

    const leaveChat = useCallback((chatId) => {
        socketRef.current?.emit("leave_chat", { chatId });
    }, []);

    const sendMessage = useCallback((chatId, content, type = "text", mediaUrl = "", replyTo = null) => {
        socketRef.current?.emit("send_message", { chatId, content, type, mediaUrl, replyTo });
    }, []);

    const startTyping = useCallback((chatId) => {
        socketRef.current?.emit("typing_start", { chatId });
    }, []);

    const stopTyping = useCallback((chatId) => {
        socketRef.current?.emit("typing_stop", { chatId });
    }, []);

    const markAsRead = useCallback((chatId) => {
        socketRef.current?.emit("message_read", { chatId });
    }, []);

    const editMessage = useCallback((chatId, messageId, newContent) => {
        socketRef.current?.emit("edit_message", { chatId, messageId, newContent });
    }, []);

    const deleteMessage = useCallback((chatId, messageId, deleteFor = "everyone") => {
        socketRef.current?.emit("delete_message", { chatId, messageId, deleteFor });
    }, []);

    return (
        <SocketContext.Provider value={{
            socket: socketRef.current,
            joinChat, leaveChat, sendMessage,
            startTyping, stopTyping, markAsRead,
            editMessage, deleteMessage,
        }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);