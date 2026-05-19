import { create } from "zustand";
import { persist } from "zustand/middleware";
import axiosInstance from "../utils/axios";
import { useAuthStore } from "./authStore";
import { db, persistChat, persistMessage, getLocalChats, getLocalMessages } from "../db/zenDB";
import { decryptMessageIfNeeded } from "../utils/e2eeHelper";

export const useChatStore = create(
    persist(
        (set, get) => ({
            chats: [],
            activeChat: null,
            messages: {},
            typingUsers: {},
            onlineUsers: new Set(),
            unreadCounts: {},
            hasMoreMessages: {},
            isLoadingMessages: false,
            isLoadingOlderMessages: false,
            isLoadingChats: false,
            isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
            setOffline: (bool) => set({ isOffline: bool }),
            isLowBandwidth: false,
            setLowBandwidth: (bool) => set({ isLowBandwidth: bool }),
            peerLowBandwidth: {},
            setPeerLowBandwidth: (userId, isLowBandwidth) => set((s) => ({
                peerLowBandwidth: { ...s.peerLowBandwidth, [userId]: isLowBandwidth }
            })),

            checkNetworkSpeed: async () => {
                if (typeof navigator === "undefined") return false;

                if (!navigator.onLine) {
                    if (get().isLowBandwidth !== true) set({ isLowBandwidth: true });
                    return true;
                }

                // Browser Network API — only trust definitive slow types (2g / saveData)
                const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                if (conn) {
                    const type = conn.effectiveType || "";
                    const definitelySlow = type === "2g" || conn.saveData === true;
                    if (definitelySlow) {
                        if (get().isLowBandwidth !== true) set({ isLowBandwidth: true });
                        return true;
                    }
                }

                // Latency probe — abort after 2.5 s
                const start = performance.now();
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2500);
                    const healthUrl = import.meta.env.VITE_API_URL
                        ? `${import.meta.env.VITE_API_URL}/api/health?t=${Date.now()}`
                        : `/api/health?t=${Date.now()}`;
                    const res = await fetch(healthUrl, {
                        method: "GET",
                        signal: controller.signal,
                        cache: "no-store",
                    });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const rtt = performance.now() - start;
                        // RTT threshold: 800 ms on a 5G/WiFi connection is very slow
                        const isSlowPing = rtt > 800;

                        // Hysteresis: increment/decrement a counter, toggle state only at ±2
                        const prev = get()._spOpConsecutive ?? 0;
                        let next;
                        if (isSlowPing) {
                            next = Math.min(prev + 1, 3);
                        } else {
                            next = Math.max(prev - 1, -3);
                        }
                        set({ _spOpConsecutive: next });

                        // Activate SP-OP after 2 consecutive slow pings, deactivate after 2 consecutive fast
                        if (next >= 2 && get().isLowBandwidth !== true) {
                            set({ isLowBandwidth: true });
                        } else if (next <= -2 && get().isLowBandwidth !== false) {
                            set({ isLowBandwidth: false });
                        }
                        return get().isLowBandwidth;
                    }
                    // Non-OK response (e.g. 404 on dev) — treat as inconclusive, keep current state
                    return get().isLowBandwidth;
                } catch (e) {
                    // Aborted = actual timeout = genuinely slow
                    if (e.name === "AbortError") {
                        const prev = get()._spOpConsecutive ?? 0;
                        const next = Math.min(prev + 1, 3);
                        set({ _spOpConsecutive: next });
                        if (next >= 2 && get().isLowBandwidth !== true) set({ isLowBandwidth: true });
                    }
                    return get().isLowBandwidth;
                }
            },

            initLocalData: async () => {
                // Reset hysteresis so stale persisted value never causes a startup false positive
                set({ _spOpConsecutive: 0 });

                const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                if (conn) {
                    conn.onchange = () => get().checkNetworkSpeed();
                }

                if (typeof window !== "undefined" && !window.netCheckInterval) {
                    // 6 s warm-up before first probe — avoids false SP-OP on cold server start
                    window.netCheckInterval = setTimeout(() => {
                        get().checkNetworkSpeed();
                        window.netCheckInterval = setInterval(() => {
                            get().checkNetworkSpeed();
                        }, 3000);
                    }, 6000);
                }

                const localChats = await getLocalChats();
                if (localChats.length > 0) {
                    const initialUnread = {};
                    await Promise.all(localChats.map(async (chat) => {
                        if (chat.lastMessage) {
                            await decryptMessageIfNeeded(chat.lastMessage);
                        }
                        initialUnread[chat._id] = chat.unreadCount || 0;
                    }));
                    set({ chats: localChats, unreadCounts: initialUnread });
                }
            },

            fetchChats: async () => {
                const local = await getLocalChats();
                if (local.length > 0 && get().chats.length === 0) {
                    await Promise.all(local.map(async (chat) => {
                        if (chat.lastMessage) {
                            await decryptMessageIfNeeded(chat.lastMessage);
                        }
                    }));
                    set({ chats: local });
                }

                set({ isLoadingChats: true });
                try {
                    const { data } = await axiosInstance.get("/chats");
                    const initialUnread = {};
                    await Promise.all(data.chats.map(async (chat) => {
                        if (chat.lastMessage) {
                            await decryptMessageIfNeeded(chat.lastMessage);
                        }
                        let count = chat.unreadCount || 0;
                        // Client-side fix: if last message is deleted for everyone or empty, and count is 1, sync it
                        if (count === 1 && chat.lastMessage && (chat.lastMessage.deletedForEveryone || (!chat.lastMessage.content && !chat.lastMessage.mediaUrl))) {
                            count = 0;
                        }
                        initialUnread[chat._id] = count;
                        persistChat({ ...chat, unreadCount: count });
                    }));
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

            updateChat: (chatId, updates) => {
                set((state) => {
                    const nextChats = state.chats.map(c => c._id === chatId ? { ...c, ...updates } : c);
                    const nextActive = state.activeChat?._id === chatId ? { ...state.activeChat, ...updates } : state.activeChat;
                    return { chats: nextChats, activeChat: nextActive };
                });
            },

            deleteInstantMessages: (chatId) => {
                const currentUserId = useAuthStore.getState().user?._id;
                set((state) => {
                    const msgs = state.messages[chatId] || [];
                    const shouldRemove = (m) =>
                        m.disappearingMode === 'instant' &&
                        m.status === 'read' &&
                        (m.senderId?._id || m.senderId)?.toString() !== currentUserId?.toString();

                    const nextMsgs = msgs.filter(m => !shouldRemove(m));

                    msgs.forEach(m => {
                        if (shouldRemove(m)) db.messages.delete(m._id).catch(() => {});
                    });

                    // Update the chat's lastMessage to the latest surviving message
                    const latest = [...nextMsgs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                    const nextChats = state.chats.map(c =>
                        c._id === chatId ? { ...c, lastMessage: latest || null } : c
                    );
                    const nextActive = state.activeChat?._id === chatId
                        ? { ...state.activeChat, lastMessage: latest || null }
                        : state.activeChat;

                    return {
                        messages: { ...state.messages, [chatId]: nextMsgs },
                        chats: nextChats,
                        activeChat: nextActive,
                    };
                });
            },

            purgeAllStuckMessages: () => {
                set((state) => {
                    const nextMessages = { ...state.messages };
                    let changed = false;
                    Object.keys(nextMessages).forEach(chatId => {
                        const msgs = nextMessages[chatId] || [];
                        const filtered = msgs.filter(m => m.status !== 'sending');
                        if (filtered.length !== msgs.length) {
                            nextMessages[chatId] = filtered;
                            changed = true;
                            // Also purge from IndexedDB
                            msgs.forEach(m => {
                                if (m.status === 'sending') db.messages.delete(m._id).catch(() => {});
                            });
                        }
                    });
                    return changed ? { messages: nextMessages } : state;
                });
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
                    const { data } = await axiosInstance.get(`/messages/${chatId}?limit=18`);
                    const serverMessages = data.messages;
                    await Promise.all(serverMessages.map(msg => decryptMessageIfNeeded(msg)));
                    serverMessages.forEach(msg => persistMessage({ ...msg, chatId: chatId.toString() }));

                    set((state) => {
                        const currentUserId = useAuthStore.getState().user?._id;
                        const existingMessages = state.messages[chatId.toString()] || [];

                        const serverById = new Map(serverMessages.map(m => [m._id?.toString(), m]));

                        const pendingOptimistic = existingMessages.filter(m => {
                            const id = m._id?.toString() || "";
                            if (!id.startsWith("temp-")) return false;
                            if (!m.cid) return false;
                            return !serverMessages.some(s => s.cid === m.cid);
                        });

                        const merged = [...serverMessages, ...pendingOptimistic];
                        merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                        const unreadCounts = { ...state.unreadCounts };
                        const hasRealUnread = merged.some(m => {
                            const senderIdStr = m.senderId?._id?.toString() || m.senderId?.toString();
                            return senderIdStr !== currentUserId &&
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
                            hasMoreMessages: {
                                ...state.hasMoreMessages,
                                [chatId.toString()]: serverMessages.length >= 18
                            }
                        };
                    });
                } catch (err) {
                    console.error("[Store] fetchMessages error:", err);
                    set({ isLoadingMessages: false });
                }
            },

            fetchOlderMessages: async (chatId) => {
                const state = get();
                const existing = state.messages[chatId.toString()] || [];
                if (existing.length === 0) return;

                set({ isLoadingOlderMessages: true });
                try {
                    const page = Math.floor(existing.length / 18) + 1;
                    const { data } = await axiosInstance.get(`/messages/${chatId}?limit=18&page=${page}`);
                    const older = data.messages;
                    await Promise.all(older.map(msg => decryptMessageIfNeeded(msg)));
                    older.forEach(msg => persistMessage({ ...msg, chatId: chatId.toString() }));

                    set((s) => {
                        const existingIds = new Set((s.messages[chatId.toString()] || []).map(m => m._id?.toString()));
                        const newOld = older.filter(m => !existingIds.has(m._id?.toString()));
                        const merged = [...newOld, ...(s.messages[chatId.toString()] || [])];
                        merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                        return {
                            messages: { ...s.messages, [chatId.toString()]: merged },
                            isLoadingOlderMessages: false,
                            hasMoreMessages: {
                                ...s.hasMoreMessages,
                                [chatId.toString()]: older.length >= 18
                            }
                        };
                    });
                } catch (err) {
                    console.error("[Store] fetchOlderMessages error:", err);
                    set({ isLoadingOlderMessages: false });
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
                            db.messages.delete(oldMsg._id);
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
                    persistMessage({ ...message, chatId });

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

                    const senderId = (message.senderId?._id || message.senderId)?.toString();
                    const updatedTypingUsers = { ...state.typingUsers };
                    if (updatedTypingUsers[chatId]) {
                        const chatTyping = { ...updatedTypingUsers[chatId] };
                        delete chatTyping[senderId];
                        updatedTypingUsers[chatId] = chatTyping;
                    }

                    return {
                        messages: { ...state.messages, [chatId]: nextMessages },
                        chats: updatedChats,
                        activeChat: updatedActiveChat,
                        unreadCounts: updatedUnreadCounts,
                        typingUsers: updatedTypingUsers,
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
                        const mId = (msg._id || msg.cid)?.toString();
                        if (mId !== messageId?.toString()) return msg;
                        // For 'delete for self' or local/ghost messages: fully remove
                        if (deleteFor === "self" || msg.status === 'sending' || !msg._id) return null;
                        // For 'delete for everyone': silently remove disappearing messages, tombstone regular ones
                        if (deleteFor === "everyone") {
                            if (msg.disappearingMode && msg.disappearingMode !== "off") return null;
                            return { ...msg, deletedForEveryone: true, content: "", mediaUrl: "" };
                        }
                        return msg;
                    }).filter(Boolean);


                    const deletedMsg = (state.messages[chatId] || []).find(
                        m => (m._id || m.cid)?.toString() === messageId?.toString()
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
                    isLoadingChats, isLoadingMessages, isLoadingOlderMessages,
                    hasMoreMessages, messages, unreadCounts, 
                    isLowBandwidth, peerLowBandwidth, isOffline, _spOpConsecutive,
                    ...rest 
                } = state;
                return rest;
            },
        }
    ));