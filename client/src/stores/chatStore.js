import { create } from "zustand";
import { persist } from "zustand/middleware";
import axiosInstance from "../utils/axios";
import { useAuthStore } from "./authStore";
import { db, persistChat, persistMessage, getLocalChats, getLocalMessages } from "../db/zenDB";

export const useChatStore = create(
    persist(
        (set, get) => ({
            chats: [],
            activeChat: null,
            messages: {},
            typingUsers: {},
            onlineUsers: new Set(),
            unreadCounts: {},
            isLoadingChats: false,
            isLoadingMessages: false,
            isOffline: !navigator.onLine,

            initLocalData: async () => {
                const localChats = await getLocalChats();
                if (localChats.length > 0) {
                    const initialUnread = {};
                    localChats.forEach(chat => {
                        initialUnread[chat._id] = chat.unreadCount || 0;
                    });
                    set({ chats: localChats, unreadCounts: initialUnread });
                }
            },

            fetchChats: async () => {
                const local = await getLocalChats();
                if (local.length > 0 && get().chats.length === 0) {
                    set({ chats: local });
                }

                set({ isLoadingChats: true });
                try {
                    const { data } = await axiosInstance.get("/chats");
                    const initialUnread = {};
                    data.chats.forEach(chat => {
                        let count = chat.unreadCount || 0;
                        // Client-side fix: if last message is deleted for everyone or empty, and count is 1, sync it
                        if (count === 1 && chat.lastMessage && (chat.lastMessage.deletedForEveryone || (!chat.lastMessage.content && !chat.lastMessage.mediaUrl))) {
                            count = 0;
                        }
                        initialUnread[chat._id] = count;
                        persistChat({ ...chat, unreadCount: count });
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

            togglePinChat: async (chatId) => {
                const { user } = useAuthStore.getState();
                if (!user) return;

                const chat = get().chats.find(c => c._id === chatId);
                if (!chat) return;

                const isCurrentlyPinned = chat.pinnedBy?.includes(user._id);
                const endpoint = isCurrentlyPinned ? `/chats/${chatId}/unpin` : `/chats/${chatId}/pin`;

                try {
                    await axiosInstance.post(endpoint);
                    set((state) => ({
                        chats: state.chats.map((c) => {
                            if (c._id !== chatId) return c;
                            const pinnedBy = c.pinnedBy || [];
                            const newPinnedBy = isCurrentlyPinned
                                ? pinnedBy.filter(id => id !== user._id)
                                : [...pinnedBy, user._id];
                            return { ...c, pinnedBy: newPinnedBy };
                        })
                    }));
                } catch (error) {
                    console.error(error);
                }
            },

            fetchMessages: async (chatId) => {
                const local = await getLocalMessages(chatId);
                if (local.length > 0) {
                    set((state) => ({
                        messages: { ...state.messages, [chatId]: local }
                    }));
                }

                set({ isLoadingMessages: true });
                try {
                    const { data } = await axiosInstance.get(`/messages/${chatId}`);
                    data.messages.forEach(msg => persistMessage({ ...msg, chatId: chatId.toString() }));
                    
                    set((state) => {
                        const newMessages = data.messages;
                        const existingMessages = state.messages[chatId.toString()] || [];
                        
                        // Merge logic: prefer server messages, but keep existing ones if not in server response
                        const merged = [...existingMessages];
                        newMessages.forEach(newMsg => {
                            const idx = merged.findIndex(m => m._id?.toString() === newMsg._id?.toString() || (newMsg.cid && m.cid === newMsg.cid));
                            if (idx !== -1) {
                                merged[idx] = { ...merged[idx], ...newMsg };
                            } else {
                                merged.push(newMsg);
                            }
                        });

                        // Final sort to ensure chronological order
                        merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                        const unreadCounts = { ...state.unreadCounts };
                        const hasRealUnread = merged.some(m => {
                            const senderIdStr = m.senderId?._id?.toString() || m.senderId?.toString();
                            return senderIdStr !== user?._id && 
                            m.status !== "read" && 
                            !m.deletedForEveryone &&
                            (m.content || m.mediaUrl || m.music);
                        });
                        
                        if (!hasRealUnread) {
                            unreadCounts[chatId.toString()] = 0;
                        }

                        return {
                            messages: { ...state.messages, [chatId.toString()]: merged },
                            unreadCounts,
                            isLoadingMessages: false,
                        };
                    });
                } catch (err) {
                    console.error("[Store] fetchMessages error:", err);
                    set({ isLoadingMessages: false });
                }
            },

            addMessage: (chatId, message) => {
                set((state) => {
                    const chatMessages = state.messages[chatId] || [];
                    let nextMessages = [...chatMessages];
                    
                    // 1. Find existing message by server _id OR client cid
                    const existingIndex = nextMessages.findIndex(m => {
                        const mId = m._id?.toString();
                        const msgId = message._id?.toString();
                        
                        // Match by server ID
                        if (msgId && mId && mId === msgId) return true;
                        
                        // Match by client ID (Optimistic match)
                        if (message.cid && m.cid && m.cid === message.cid) return true;
                        
                        return false;
                    });

                    if (existingIndex !== -1) {
                        const oldMsg = nextMessages[existingIndex];
                        
                        // If we are replacing an optimistic message (temp ID) with a real one (server ID)
                        // we MUST remove the temp ID from the local database
                        if (oldMsg._id !== message._id && oldMsg._id?.toString().startsWith('temp-')) {
                            import("../db/zenDB").then(db => db.db.messages.delete(oldMsg._id));
                        }

                        // Merge server data over local data
                        nextMessages[existingIndex] = { 
                            ...oldMsg, 
                            ...message,
                            status: message.status || oldMsg.status
                        };
                    } else {
                        nextMessages.push(message);
                    }

                    // 2. Persist the (final) message to IndexedDB
                    import("../db/zenDB").then(db => db.persistMessage({ ...message, chatId }));

                    const currentUserId = useAuthStore.getState().user?._id;
                    const isFromMe =
                        message.senderId?.toString() === currentUserId?.toString() ||
                        message.senderId?._id?.toString() === currentUserId?.toString();
                    const isActiveChat = state.activeChat?._id?.toString() === chatId?.toString();

                    const updatedChats = state.chats
                        .map((chat) => {
                            if (chat._id?.toString() !== chatId?.toString()) return chat;
                            const currentUpdatedAt = chat.updatedAt ? new Date(chat.updatedAt) : new Date(0);
                            const msgDate = new Date(message.createdAt);
                            if (msgDate >= currentUpdatedAt) {
                                return { ...chat, lastMessage: { ...message }, updatedAt: message.createdAt };
                            }
                            return chat;
                        })
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

            setTypingUser: (chatId, userId, isTyping, scramble) => {
                set((state) => {
                    const chatTyping = { ...(state.typingUsers[chatId] || {}) };
                    if (isTyping) {
                        chatTyping[userId] = scramble || true;
                    } else {
                        delete chatTyping[userId];
                    }
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

            removeChat: (chatId) => {
                set((state) => ({
                    chats: state.chats.filter((c) => c._id?.toString() !== chatId?.toString()),
                    activeChat: state.activeChat?._id?.toString() === chatId?.toString() ? null : state.activeChat,
                    messages: (() => {
                        const m = { ...state.messages };
                        delete m[chatId];
                        delete m[chatId?.toString()];
                        return m;
                    })(),
                }));
            },

            getActiveChatMessages: () => {
                const { activeChat, messages } = get();
                if (!activeChat) return [];
                return messages[activeChat._id] || [];
            },

            isUserTypingInChat: (chatId, userId) => {
                const { typingUsers } = get();
                return !!typingUsers[chatId]?.[userId];
            },
            
            getTypingScramble: (chatId, userId) => {
                const { typingUsers } = get();
                const val = typingUsers[chatId]?.[userId];
                return typeof val === "string" ? val : "";
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

            toggleStarMessage: async (messageId, chatId) => {
                const { user } = useAuthStore.getState();
                const chatMessages = get().messages[chatId] || [];
                const msg = chatMessages.find(m => m._id === messageId);
                if (!msg) return;

                const isStarred = msg.starredBy?.includes(user._id);
                const endpoint = isStarred ? `/messages/${messageId}/unstar` : `/messages/${messageId}/star`;

                try {
                    await axiosInstance.post(endpoint);
                    set((state) => {
                        const updatedMessages = (state.messages[chatId] || []).map(m => {
                            if (m._id !== messageId) return m;
                            const starredBy = m.starredBy || [];
                            const newStarredBy = isStarred
                                ? starredBy.filter(id => id !== user._id)
                                : [...starredBy, user._id];
                            return { ...m, starredBy: newStarredBy };
                        });
                        return { messages: { ...state.messages, [chatId]: updatedMessages } };
                    });
                } catch (error) {
                    console.error(error);
                }
            },

            markViewOnceAsViewed: async (messageId, chatId) => {
                const { user } = useAuthStore.getState();
                try {
                    await axiosInstance.post(`/messages/${messageId}/view`);
                    set((state) => {
                        const updatedMessages = (state.messages[chatId] || []).map(m => {
                            if (m._id !== messageId) return m;
                            const viewedBy = m.viewedBy || [];
                            if (viewedBy.includes(user._id)) return m;
                            return { ...m, viewedBy: [...viewedBy, user._id] };
                        });
                        return { messages: { ...state.messages, [chatId]: updatedMessages } };
                    });
                } catch (error) {
                    console.error(error);
                }
            },
        }),
        {
            name: "zenchat-chats",
            partialize: (state) => {
                const { 
                    activeChat, onlineUsers, typingUsers, 
                    isLoadingChats, isLoadingMessages, ...rest 
                } = state;
                return rest;
            },
        }
    ));