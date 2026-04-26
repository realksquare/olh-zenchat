import { create } from "zustand";
import axiosInstance from "../utils/axios";

export const useMomentStore = create((set, get) => ({
    moments: [],
    isLoading: false,
    error: null,

    fetchMoments: async () => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.get("/moments");
            set({ moments: res.data, isLoading: false });
        } catch (err) {
            set({ error: "Failed to fetch moments", isLoading: false });
        }
    },

    createMoment: async (momentData) => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.post("/moments", momentData);
            set((state) => ({ 
                moments: [res.data, ...state.moments],
                isLoading: false 
            }));
            return { success: true, moment: res.data };
        } catch (err) {
            set({ error: "Failed to create moment", isLoading: false });
            return { success: false, message: err.response?.data?.message || "Error" };
        }
    },

    viewMoment: async (momentId, userId) => {
        try {
            await axiosInstance.post(`/moments/${momentId}/view`);
            // We don't remove it from state anymore because the server 
            // handles filtering for GET /moments, but for immediate 
            // disappearance we can keep it, or let the user see it once
            // Actually, the user says "it disappears at that time... but refresh brings it back"
            // So we should filter it out locally too.
            set((state) => ({
                moments: state.moments.filter(m => {
                    const isOwn = (m.userId?._id || m.userId) === userId;
                    if (isOwn) return true;
                    return m._id !== momentId;
                })
            }));
        } catch (err) {
            console.error("Failed to view moment:", err);
        }
    },

    deleteMoment: async (momentId) => {
        try {
            await axiosInstance.delete(`/moments/${momentId}`);
            set((state) => ({
                moments: state.moments.filter(m => m._id !== momentId)
            }));
        } catch (err) {
            console.error("Failed to delete moment:", err);
        }
    },

    addMoment: (moment) => {
        set((state) => {
            if (state.moments.some(m => m._id === moment._id)) return state;
            return { moments: [moment, ...state.moments] };
        });
    },

    hasActiveMoment: (userId) => {
        const moments = get().moments;
        const uid = typeof userId === 'string' ? userId : (userId?._id || userId);
        return moments.some(m => {
            const mid = m.userId?._id || m.userId;
            return mid === uid;
        });
    },

    getHaloColor: (userId) => {
        if (!userId) return "#3b82f6";
        const idStr = typeof userId === 'string' ? userId : (userId._id || userId || '');
        if (!idStr) return "#3b82f6";
        
        const colors = [
            "#3b82f6", // Blue
            "#10b981", // Emerald
            "#f59e0b", // Amber
            "#ef4444", // Red
            "#8b5cf6", // Violet
            "#ec4899", // Pink
            "#06b6d4", // Cyan
            "#f472b6", // Light Pink
            "#fbbf24", // Yellow
            "#a78bfa"  // Lavender
        ];
        
        let hash = 0;
        for (let i = 0; i < idStr.length; i++) {
            hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }
}));
