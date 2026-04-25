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
            set((state) => ({
                moments: state.moments.filter(m => {
                    const mid = m.userId?._id || m.userId;
                    const uid = userId?._id || userId;
                    return m._id !== momentId || mid === uid;
                })
            }));
        } catch (err) {
            console.error("Failed to view moment:", err);
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
        return moments.some(m => {
            const mid = m.userId?._id || m.userId;
            const uid = userId?._id || userId;
            return mid === uid;
        });
    },

    getHaloColor: (userId) => {
        if (!userId) return "#3b82f6";
        const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
        const idStr = typeof userId === 'string' ? userId : (userId._id || '');
        const hash = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }
}));
