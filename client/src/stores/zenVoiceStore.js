import { create } from "zustand";
import axiosInstance from "../utils/axios";
import { io } from "socket.io-client";

const INITIAL_STATE = {
    isVerified: false,
    verificationMethod: "none",
    pseudonym: "",
    pseudonymColor: "",
    collegeName: "",
    collegeEmailDomain: "",
    sessionToken: null,
    rooms: [],
    activeRoomId: null,
    messages: [],
    memberCount: 0,
    isConnectedToRoom: false,
    totalUnreadCount: 0,
    idleWarning: false,
    resetCountdown: false,
    purgeLockdown: false,
    restrictedMessages: new Set(),
    blockedPseudonyms: new Set(),
    socket: null,
    isLoading: false,
    error: null
};

export const useZenVoiceStore = create((set, get) => ({
    ...INITIAL_STATE,

    connectSocket: (token) => {
        const { socket } = get();
        if (socket) return;

        const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
        const zvSocket = io(`${socketUrl}/zenvoice`, {
            auth: { token },
            transports: ["websocket"]
        });

        zvSocket.on("connect", () => {
            set({ isConnectedToRoom: true });
        });

        zvSocket.on("disconnect", () => {
            set({ isConnectedToRoom: false });
        });

        zvSocket.on("new_message", ({ message }) => {
            const { activeRoomId, messages } = get();
            if (message.roomId === activeRoomId) {
                set({ messages: [...messages, message] });
            }
        });

        zvSocket.on("message_restricted", ({ messageId, restrictedByCount, globalBlur }) => {
            const { messages } = get();
            set({
                messages: messages.map(m =>
                    m._id === messageId ? { ...m, restrictedBy: Array.from(new Set([...m.restrictedBy, "peer"])), globalBlur } : m
                )
            });
        });

        zvSocket.on("member_count", ({ roomId, memberCount }) => {
            const { activeRoomId } = get();
            if (roomId === activeRoomId) {
                set({ memberCount });
            }
        });

        zvSocket.on("room_reset_countdown", ({ minutesLeft }) => {
            set({ resetCountdown: minutesLeft });
        });

        zvSocket.on("room_idle_warning", ({ minutesLeft }) => {
            set({ idleWarning: minutesLeft });
        });

        zvSocket.on("purge_lockdown_start", () => {
            set({ purgeLockdown: true });
        });

        zvSocket.on("purge_lockdown_end", () => {
            set({ purgeLockdown: false });
        });

        zvSocket.on("room_reset", () => {
            set({ messages: [], resetCountdown: false, idleWarning: false });
        });

        zvSocket.on("red_card_warning", ({ redCardCount, suspendedUntil }) => {
            window.dispatchEvent(new CustomEvent("zenvoice-red-card", { detail: { redCardCount, suspendedUntil } }));
        });

        zvSocket.on("connect_error", (err) => {
            console.error("ZenVoice Socket Connection Error:", err.message);
        });

        set({ socket: zvSocket });
    },

    disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
            set({ socket: null, isConnectedToRoom: false });
        }
    },

    joinRoomSocket: (roomId) => {
        const { socket } = get();
        if (socket) {
            socket.emit("join_room", { roomId });
            set({ activeRoomId: roomId, messages: [], idleWarning: false, resetCountdown: false });
        }
    },

    leaveRoomSocket: (roomId) => {
        const { socket } = get();
        if (socket) {
            socket.emit("leave_room", { roomId });
            set({ activeRoomId: null, messages: [], memberCount: 0 });
        }
    },

    sendMessageSocket: (roomId, content, type = "text", mediaUrl = null) => {
        const { socket } = get();
        if (socket) {
            socket.emit("send_message", { roomId, content, type, mediaUrl });
        }
    },

    checkStatus: async () => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.get("/zenvoice/status");
            set({
                isVerified: data.isVerified,
                verificationMethod: data.verificationMethod,
                pseudonym: data.pseudonym || "",
                pseudonymColor: data.pseudonymColor || "",
                collegeName: data.collegeName || "",
                collegeEmailDomain: data.domain || "",
                sessionToken: data.sessionToken || null,
                isLoading: false
            });
            if (data.isVerified && data.sessionToken) {
                get().connectSocket(data.sessionToken);
            }
            return { success: true, isVerified: data.isVerified };
        } catch (err) {
            set({ isLoading: false, error: err.response?.data?.message || "Failed to check status" });
            return { success: false };
        }
    },

    requestDomainOTP: async (institutionalEmail) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/zenvoice/verify/domain-otp/send", { institutionalEmail });
            set({ isLoading: false });
            return {
                success: true,
                domainPending: data.domainPending || false,
                message: data.message
            };
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to send OTP";
            set({ isLoading: false, error: msg });
            return { success: false, message: msg };
        }
    },

    confirmDomainOTP: async (otp) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/zenvoice/verify/domain-otp/confirm", { otp });
            set({
                isVerified: true,
                verificationMethod: "domain_otp",
                pseudonym: data.pseudonym,
                pseudonymColor: data.pseudonymColor,
                collegeName: data.collegeName,
                collegeEmailDomain: data.domain,
                sessionToken: data.sessionToken,
                isLoading: false
            });
            get().connectSocket(data.sessionToken);
            return { success: true };
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to verify OTP";
            set({ isLoading: false, error: msg });
            return { success: false, message: msg };
        }
    },

    submitPseudonymRequest: async (desiredPseudonym) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/zenvoice/pseudonym-request", { desiredPseudonym });
            set({ isLoading: false });
            return { success: true, message: data.message };
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to request pseudonym change";
            set({ isLoading: false, error: msg });
            return { success: false, message: msg };
        }
    },

    fetchRooms: async () => {
        const { sessionToken } = get();
        if (!sessionToken) return;
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.get("/zenvoice/rooms", {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            set({ rooms: data.rooms, isLoading: false });
        } catch (err) {
            set({ isLoading: false, error: err.response?.data?.message || "Failed to fetch rooms" });
        }
    },

    createRoom: async (name, description, lockToDomain) => {
        const { sessionToken, rooms } = get();
        if (!sessionToken) return { success: false };
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post(
                "/zenvoice/rooms",
                { name, description, lockToDomain },
                { headers: { Authorization: `Bearer ${sessionToken}` } }
            );
            set({ rooms: [data.room, ...rooms], isLoading: false });
            return { success: true, room: data.room };
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to create room";
            set({ isLoading: false, error: msg });
            return { success: false, message: msg };
        }
    },

    searchRooms: async (query) => {
        const { sessionToken } = get();
        if (!sessionToken) return [];
        try {
            const { data } = await axiosInstance.get(`/zenvoice/rooms/search?query=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            return data.rooms || [];
        } catch (err) {
            console.error("Search rooms error:", err);
            return [];
        }
    },

    joinRoom: async (roomId) => {
        const { sessionToken } = get();
        if (!sessionToken) return;
        try {
            await axiosInstance.post(`/zenvoice/rooms/${roomId}/join`, {}, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            get().joinRoomSocket(roomId);
        } catch (err) {
            console.error("Join room error:", err);
        }
    },

    joinInvite: async (token) => {
        const { sessionToken, rooms } = get();
        if (!sessionToken) return { success: false };
        try {
            const { data } = await axiosInstance.post(`/zenvoice/rooms/invite/${token}`, {}, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            if (data.room && !rooms.some(r => r._id === data.room._id)) {
                set({ rooms: [data.room, ...rooms] });
            }
            return { success: true, room: data.room };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to join room via invite link" };
        }
    },

    leaveRoom: async (roomId) => {
        const { sessionToken, rooms } = get();
        if (!sessionToken) return;
        try {
            await axiosInstance.post(`/zenvoice/rooms/${roomId}/leave`, {}, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            get().leaveRoomSocket(roomId);
            set({ rooms: rooms.filter(r => r._id !== roomId) });
        } catch (err) {
            console.error("Leave room error:", err);
        }
    },

    fetchMessages: async (roomId, before = null) => {
        const { sessionToken, messages } = get();
        if (!sessionToken) return;
        try {
            const url = before
                ? `/zenvoice/rooms/${roomId}/messages?before=${encodeURIComponent(before)}`
                : `/zenvoice/rooms/${roomId}/messages`;
            const { data } = await axiosInstance.get(url, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            if (before) {
                set({ messages: [...data.messages, ...messages] });
            } else {
                set({ messages: data.messages });
            }
        } catch (err) {
            console.error("Fetch messages error:", err);
        }
    },

    restrictMessage: async (messageId) => {
        const { sessionToken, restrictedMessages } = get();
        if (!sessionToken) return;
        try {
            await axiosInstance.post(`/zenvoice/message/${messageId}/restrict`, {}, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            const updated = new Set(restrictedMessages);
            updated.add(messageId);
            set({ restrictedMessages: updated });
        } catch (err) {
            console.error("Restrict message error:", err);
        }
    },

    reportMessage: async (messageId, reason, evidence) => {
        const { sessionToken } = get();
        if (!sessionToken) return;
        try {
            await axiosInstance.post(`/zenvoice/message/${messageId}/report`, { reason, evidence }, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            return { success: true };
        } catch (err) {
            console.error("Report message error:", err);
            return { success: false, message: err.response?.data?.message || "Failed to submit report" };
        }
    },

    counterReport: async (reportId, reason) => {
        const { sessionToken } = get();
        if (!sessionToken) return;
        try {
            await axiosInstance.post(`/zenvoice/report/${reportId}/counter`, { reason }, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            return { success: true };
        } catch (err) {
            console.error("Counter report error:", err);
            return { success: false, message: err.response?.data?.message || "Failed to counter report" };
        }
    },

    bridgeDM: async (targetPseudonym) => {
        const { sessionToken } = get();
        if (!sessionToken) return { success: false };
        try {
            const { data } = await axiosInstance.post(`/zenvoice/bridge-dm/${targetPseudonym}`, {}, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            return { success: true, chatId: data.chatId };
        } catch (err) {
            console.error("DM bridge request failed:", err);
            return { success: false, message: err.response?.data?.message || "Failed to initiate DM request." };
        }
    },

    resetStore: () => {
        get().disconnectSocket();
        set(INITIAL_STATE);
    }
}));
