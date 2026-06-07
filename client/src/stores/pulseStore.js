import { create } from "zustand";
import axiosInstance from "../utils/axios";

// Helper to generate a browser fingerprint for guest voting without external libs
const generateFingerprint = async () => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('ZenPulse', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('ZenPulse', 4, 17);
        const dataUrl = canvas.toDataURL();
        const baseString = dataUrl + navigator.userAgent + navigator.language + screen.colorDepth;
        
        const msgBuffer = new TextEncoder().encode(baseString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (e) {
        return "fallback_fingerprint_" + Math.random().toString(36).substring(2);
    }
};

export const usePulseStore = create((set, get) => ({
    todayQuestion: null,
    yesterdayQuestion: null,
    myVote: null,
    streak: { current: 0, longest: 0 },
    votedQuestionIds: [],
    history: [],
    historyHasMore: false,
    historyPage: 1,
    isLoading: false,

    fetchToday: async () => {
        try {
            set({ isLoading: true });
            const res = await axiosInstance.get("/pulse/today");
            set({ todayQuestion: res.data.question, isLoading: false });
        } catch (err) {
            console.error(err);
            set({ isLoading: false });
        }
    },

    fetchYesterday: async () => {
        try {
            const res = await axiosInstance.get("/pulse/yesterday");
            set({ yesterdayQuestion: res.data.question });
        } catch (err) {
            console.error(err);
        }
    },

    fetchMyStatus: async () => {
        try {
            const res = await axiosInstance.get("/pulse/my-status");
            set({ 
                streak: res.data.streak || { current: 0, longest: 0 },
                myVote: res.data.myVote,
                votedQuestionIds: res.data.votedQuestionIds || []
            });
        } catch (err) {
            console.error(err);
        }
    },

    fetchHistory: async (page = 1) => {
        try {
            const res = await axiosInstance.get(`/pulse/history?page=${page}`);
            if (page === 1) {
                set({ history: res.data.questions, historyHasMore: res.data.hasMore, historyPage: page });
            } else {
                set(state => ({ 
                    history: [...state.history, ...res.data.questions], 
                    historyHasMore: res.data.hasMore,
                    historyPage: page 
                }));
            }
        } catch (err) {
            console.error(err);
        }
    },

    submitAuthVote: async (questionId, optionId) => {
        try {
            // Check if there's a guest token cookie/localstorage to merge
            const guestTokenToMerge = localStorage.getItem("zenpulse_guest_token") || null;
            const res = await axiosInstance.post("/pulse/vote", { 
                questionId, 
                optionId,
                guestTokenToMerge
            });
            
            if (guestTokenToMerge) {
                localStorage.removeItem("zenpulse_guest_token");
            }

            set(state => ({
                myVote: { optionId, questionId },
                streak: res.data.streak,
                votedQuestionIds: [...state.votedQuestionIds, questionId]
            }));
            
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to vote" };
        }
    },

    submitGuestVote: async (questionId, optionId, referredBy) => {
        try {
            const fingerprint = await generateFingerprint();
            const res = await axiosInstance.post("/pulse/vote/guest", {
                questionId,
                optionId,
                fingerprint,
                referredBy
            });
            
            // Store a hint that they voted as guest, so if they register we can link it
            localStorage.setItem("zenpulse_guest_token", fingerprint);
            
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to vote" };
        }
    }
}));
