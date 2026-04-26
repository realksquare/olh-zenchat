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
            const moments = Array.isArray(res.data) ? res.data : (res.data.moments || []);
            set({ moments, isLoading: false });
        } catch (err) {
            set({ error: "Failed to fetch moments", isLoading: false });
        }
    },

    createMoment: async (momentData) => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.post("/moments", momentData);
            const newMoment = res.data.moment || res.data;
            set((state) => ({ 
                moments: [newMoment, ...state.moments],
                isLoading: false 
            }));
            return { success: true, moment: newMoment };
        } catch (err) {
            set({ error: "Failed to create moment", isLoading: false });
            return { success: false, message: err.response?.data?.message || "Error" };
        }
    },

    viewMoment: async (momentId, userId) => {
        try {
            await axiosInstance.post(`/moments/${momentId}/view`);
            // Remove from local store after viewing
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

    removeMoment: (momentId) => {
        set((state) => ({
            moments: state.moments.filter(m => m._id !== momentId)
        }));
    },

    hasActiveMoment: (userId) => {
        const moments = get().moments;
        const uid = typeof userId === 'string' ? userId : (userId?._id || userId);
        return moments.some(m => {
            const mid = m.userId?._id || m.userId;
            return mid === uid;
        });
    },

    getHaloColor: (userId, currentUserId) => {
        if (!userId) return "#082f49"; // Sapphire fallback
        const uid = typeof userId === 'string' ? userId : (userId._id || userId || '');
        const cuid = typeof currentUserId === 'string' ? currentUserId : (currentUserId?._id || currentUserId || '');
        
        if (uid === cuid) return "#082f49"; // Sapphire for own
        return "#10b981"; // Emerald for others
    }
}));
