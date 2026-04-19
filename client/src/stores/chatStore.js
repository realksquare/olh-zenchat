import { create } from "zustand";
import axiosInstance from "../utils/axios";
import { useAuthStore } from "./authStore";

export const useChatStore = create((set, get) => ({
    chats: [],
    activeChat: null,
    messages: {},
    typingUsers: {},
    onlineUsers: new Set(),
    unreadCounts: {},
    isLoadingChats: false,
    isLoadingMessages: false,

    fetchChats: async () => {
        set({ isLoadingChats: true });
        try {
            const { data } = await axiosInstance.get("/chats");
            const initialUnread = {};
            const currentUserId = useAuthStore.getState().user?._id;

            data.chats.forEach(chat => {
                initialUnread[chat._id] = chat.unreadCount || 0;
            });

            set({ chats: data.chats, unreadCounts: initialUnread, isLoadingChats: false });
        } catch (_) {
            set({ isLoadingChats: false });
        }
    },

    setActiveChat: (chat) => {
        set((state) => ({
            activeChat: chat ? { ...chat } : null,
            unreadCounts: chat
                ? { ...state.unreadCounts, [chat._id]: 0 }
                : state.unreadCounts,
        }));
    },

    fetchMessages: async (chatId) => {
        set({ isLoadingMessages: true });
        try {
            const { data } = await axiosInstance.get(`/messages/${chatId}`);
            set((state) => ({
                messages: { ...state.messages, [chatId]: data.messages },
                isLoadingMessages: false,
            }));
        } catch (_) {
            set({ isLoadingMessages: false });
        }
    },

    addMessage: (chatId, message) => {
        set((state) => {
            const chatMessages = state.messages[chatId] || [];

            let nextMessages = [...chatMessages];
            const existingIndex = nextMessages.findIndex(
                m => m._id?.toString() === message._id?.toString()
            );

            if (existingIndex !== -1) {
                nextMessages[existingIndex] = { ...nextMessages[existingIndex], ...message };
            } else {
                nextMessages.push(message);
            }

            const currentUserId = useAuthStore.getState().user?._id;
            const isFromMe =
                message.senderId?.toString() === currentUserId?.toString() ||
                message.senderId?._id?.toString() === currentUserId?.toString();
            const isActiveChat = state.activeChat?._id?.toString() === chatId?.toString();

            const updatedChats = state.chats
                .map((chat) =>
                    chat._id?.toString() === chatId?.toString()
                        ? { ...chat, lastMessage: { ...message }, updatedAt: message.createdAt }
                        : chat
                )
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            let updatedActiveChat = state.activeChat;
            if (isActiveChat) {
                updatedActiveChat = {
                    ...state.activeChat,
                    lastMessage: { ...message },
                    updatedAt: message.createdAt,
                };
            }

            const updatedUnreadCounts = { ...state.unreadCounts };
            if (!isFromMe && !isActiveChat && existingIndex === -1) {
                updatedUnreadCounts[chatId] = (state.unreadCounts[chatId] || 0) + 1;
            }

            return {
                messages: { ...state.messages, [chatId]: nextMessages },
                chats: updatedChats,
                activeChat: updatedActiveChat,
                unreadCounts: updatedUnreadCounts,
            };
        });
    },

    updateMessage: (chatId, updatedMessage) => {
        set((state) => {
            const updatedMessages = (state.messages[chatId] || []).map((msg) =>
                msg._id?.toString() === updatedMessage._id?.toString()
                    ? { ...msg, ...updatedMessage }
                    : msg
            );

            const updatedChats = state.chats.map((chat) =>
                chat._id?.toString() === chatId?.toString() &&
                    chat.lastMessage?._id?.toString() === updatedMessage._id?.toString()
                    ? { ...chat, lastMessage: { ...chat.lastMessage, ...updatedMessage } }
                    : chat
            );

            let updatedActiveChat = state.activeChat;
            if (
                state.activeChat?._id?.toString() === chatId?.toString() &&
                state.activeChat.lastMessage?._id?.toString() === updatedMessage._id?.toString()
            ) {
                updatedActiveChat = {
                    ...state.activeChat,
                    lastMessage: { ...state.activeChat.lastMessage, ...updatedMessage },
                };
            }

            return {
                messages: { ...state.messages, [chatId]: updatedMessages },
                chats: updatedChats,
                activeChat: updatedActiveChat,
            };
        });
    },

    deleteMessage: (chatId, messageId, deleteFor) => {
        set((state) => {
            const currentUserId = useAuthStore.getState().user?._id;

            const updatedMessages = (state.messages[chatId] || []).map((msg) => {
                if (msg._id?.toString() !== messageId?.toString()) return msg;
                if (deleteFor === "everyone") return { ...msg, deletedForEveryone: true, content: "", mediaUrl: "" };
                if (deleteFor === "self") return { ...msg, deletedFor: [...(msg.deletedFor || []), currentUserId] };
                return msg;
            });

            const deletedMsg = updatedMessages.find(
                m => m._id?.toString() === messageId?.toString()
            );
            const isLastMessage =
                state.chats.find(c => c._id?.toString() === chatId?.toString())
                    ?.lastMessage?._id?.toString() === messageId?.toString();

            let newLastMessage = state.chats.find(
                c => c._id?.toString() === chatId?.toString()
            )?.lastMessage;

            if (isLastMessage) {
                const visible = updatedMessages.filter(
                    m => !m.deletedForEveryone && !m.deletedFor?.includes(currentUserId) && m._id?.toString() !== messageId?.toString()
                );
                newLastMessage = visible.length > 0 ? visible[visible.length - 1] : null;
            }

            const updatedChats = state.chats.map((chat) => {
                if (chat._id?.toString() !== chatId?.toString()) return chat;
                if (isLastMessage) {
                    return { ...chat, lastMessage: newLastMessage };
                }
                return chat;
            });

            let updatedActiveChat = state.activeChat;
            if (
                state.activeChat?._id?.toString() === chatId?.toString() &&
                isLastMessage
            ) {
                updatedActiveChat = { ...state.activeChat, lastMessage: newLastMessage };
            }

            const updatedUnreadCounts = { ...state.unreadCounts };
            if (deletedMsg && deletedMsg.status !== "read" && 
                deletedMsg.senderId?.toString() !== currentUserId?.toString() &&
                deletedMsg.senderId?._id?.toString() !== currentUserId?.toString()) {
                updatedUnreadCounts[chatId] = Math.max(0, (updatedUnreadCounts[chatId] || 0) - 1);
            }

            return {
                messages: { ...state.messages, [chatId]: updatedMessages },
                chats: updatedChats,
                activeChat: updatedActiveChat,
                unreadCounts: updatedUnreadCounts,
            };
        });
    },

    clearUnread: (chatId) => {
        set((state) => ({
            unreadCounts: { ...state.unreadCounts, [chatId]: 0 },
        }));
    },

    updateMessageStatus: (chatId, messageId, status) => {
        set((state) => {
            const chatMessages = state.messages[chatId] || [];
            const updatedMessages = chatMessages.map((msg) => {
                if (msg._id?.toString() === messageId?.toString()) {
                    if (msg.status === "read" && status === "delivered") return msg;
                    return { ...msg, status };
                }
                return msg;
            });

            const updatedChats = state.chats.map((chat) => {
                if (chat._id?.toString() === chatId?.toString() && chat.lastMessage?._id?.toString() === messageId?.toString()) {
                    if (chat.lastMessage.status === "read" && status === "delivered") return chat;
                    return { ...chat, lastMessage: { ...chat.lastMessage, status } };
                }
                return chat;
            });

            let updatedActiveChat = state.activeChat;
            if (
                state.activeChat?._id?.toString() === chatId?.toString() &&
                state.activeChat.lastMessage?._id?.toString() === messageId?.toString()
            ) {
                updatedActiveChat = {
                    ...state.activeChat,
                    lastMessage: { ...state.activeChat.lastMessage, status },
                };
            }

            return {
                messages: { ...state.messages, [chatId]: updatedMessages },
                chats: updatedChats,
                activeChat: updatedActiveChat,
            };
        });
    },

    markChatAsRead: (chatId) => {
        set((state) => {
            const currentUserId = useAuthStore.getState().user?._id;

            const updatedMessages = (state.messages[chatId] || []).map((msg) => {
                const isFromMe = msg.senderId?.toString() === currentUserId?.toString() || 
                                 msg.senderId?._id?.toString() === currentUserId?.toString();
                if (!isFromMe && msg.status !== "read") {
                    return { ...msg, status: "read" };
                }
                return msg;
            });

            const updatedChats = state.chats.map((chat) => {
                if (chat._id?.toString() === chatId?.toString() && chat.lastMessage) {
                    const isFromMe = chat.lastMessage.senderId?.toString() === currentUserId?.toString() || 
                                     chat.lastMessage.senderId?._id?.toString() === currentUserId?.toString();
                    if (!isFromMe) {
                        return { ...chat, lastMessage: { ...chat.lastMessage, status: "read" } };
                    }
                }
                return chat;
            });

            let updatedActiveChat = state.activeChat;
            if (
                state.activeChat?._id?.toString() === chatId?.toString() &&
                state.activeChat.lastMessage
            ) {
                const isFromMe = state.activeChat.lastMessage.senderId?.toString() === currentUserId?.toString() || 
                                 state.activeChat.lastMessage.senderId?._id?.toString() === currentUserId?.toString();
                if (!isFromMe) {
                    updatedActiveChat = {
                        ...state.activeChat,
                        lastMessage: { ...state.activeChat.lastMessage, status: "read" },
                    };
                }
            }

            return {
                messages: { ...state.messages, [chatId]: updatedMessages },
                chats: updatedChats,
                activeChat: updatedActiveChat,
                unreadCounts: { ...state.unreadCounts, [chatId]: 0 },
            };
        });
    },

    markMessagesAsReadByOther: (chatId) => {
        set((state) => {
            const currentUserId = useAuthStore.getState().user?._id;

            const updatedMessages = (state.messages[chatId] || []).map((msg) => {
                const isFromMe = msg.senderId?.toString() === currentUserId?.toString() || 
                                 msg.senderId?._id?.toString() === currentUserId?.toString();
                if (isFromMe && msg.status !== "read") {
                    return { ...msg, status: "read" };
                }
                return msg;
            });

            const updatedChats = state.chats.map((chat) => {
                if (chat._id?.toString() === chatId?.toString() && chat.lastMessage) {
                    const isFromMe = chat.lastMessage.senderId?.toString() === currentUserId?.toString() || 
                                     chat.lastMessage.senderId?._id?.toString() === currentUserId?.toString();
                    if (isFromMe) {
                        return { ...chat, lastMessage: { ...chat.lastMessage, status: "read" } };
                    }
                }
                return chat;
            });

            let updatedActiveChat = state.activeChat;
            if (
                state.activeChat?._id?.toString() === chatId?.toString() &&
                state.activeChat.lastMessage
            ) {
                const isFromMe = state.activeChat.lastMessage.senderId?.toString() === currentUserId?.toString() || 
                                 state.activeChat.lastMessage.senderId?._id?.toString() === currentUserId?.toString();
                if (isFromMe) {
                    updatedActiveChat = {
                        ...state.activeChat,
                        lastMessage: { ...state.activeChat.lastMessage, status: "read" },
                    };
                }
            }

            return {
                messages: { ...state.messages, [chatId]: updatedMessages },
                chats: updatedChats,
                activeChat: updatedActiveChat,
            };
        });
    },



    updateParticipantStatus: (userId, isOnline, lastSeen) => {
        set((state) => {
            const updatedChats = state.chats.map((chat) => ({
                ...chat,
                participants: chat.participants.map((p) =>
                    p._id?.toString() === userId?.toString()
                        ? { ...p, isOnline, lastSeen: lastSeen || p.lastSeen }
                        : p
                ),
            }));

            let updatedActiveChat = state.activeChat;
            if (state.activeChat) {
                updatedActiveChat = {
                    ...state.activeChat,
                    participants: state.activeChat.participants.map((p) =>
                        p._id?.toString() === userId?.toString()
                            ? { ...p, isOnline, lastSeen: lastSeen || p.lastSeen }
                            : p
                    ),
                };
            }

            return { chats: updatedChats, activeChat: updatedActiveChat };
        });
    },

    setTypingUser: (chatId, userId, isTyping) => {
        set((state) => {
            const chatTyping = new Set(state.typingUsers[chatId] || []);
            isTyping ? chatTyping.add(userId) : chatTyping.delete(userId);
            return { typingUsers: { ...state.typingUsers, [chatId]: chatTyping } };
        });
    },

    setUserOnline: (userId) => {
        set((state) => {
            const updated = new Set(state.onlineUsers);
            updated.add(userId);
            return { onlineUsers: updated };
        });
    },

    setUserOffline: (userId) => {
        set((state) => {
            const updated = new Set(state.onlineUsers);
            updated.delete(userId);
            return { onlineUsers: updated };
        });
    },

    addChat: (chat) => {
        set((state) => {
            const exists = state.chats.find((c) => c._id?.toString() === chat._id?.toString());
            if (exists) return state;
            return { chats: [{ ...chat }, ...state.chats] };
        });
    },

    getActiveChatMessages: () => {
        const { activeChat, messages } = get();
        if (!activeChat) return [];
        return messages[activeChat._id] || [];
    },

    isUserTypingInChat: (chatId, userId) => {
        const { typingUsers } = get();
        return typingUsers[chatId]?.has(userId) || false;
    },

    deleteChatForUser: async (chatId) => {
        try {
            await axiosInstance.delete(`/chats/${chatId}`);
            set((state) => ({
                chats: state.chats.filter((c) => c._id !== chatId),
                activeChat: state.activeChat?._id === chatId ? null : state.activeChat,
            }));
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || "Error deleting chat" };
        }
    },
}));