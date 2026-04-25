import { create } from "zustand";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const useMomentStore = create((set, get) => ({
    moments: [],
    isLoading: false,
    error: null,

    fetchMoments: async () => {
        set({ isLoading: true });
        try {
            const res = await axios.get(`${API_URL}/moments`, { withCredentials: true });
            set({ moments: res.data, isLoading: false });
        } catch (err) {
            set({ error: "Failed to fetch moments", isLoading: false });
        }
    },

    createMoment: async (momentData) => {
        set({ isLoading: true });
        try {
            const res = await axios.post(`${API_URL}/moments`, momentData, { withCredentials: true });
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

    viewMoment: async (momentId) => {
        try {
            await axios.post(`${API_URL}/moments/${momentId}/view`, {}, { withCredentials: true });
            // Remove from local state because it's "viewed once" (One-Breath rule)
            set((state) => ({
                moments: state.moments.filter(m => m._id !== momentId)
            }));
        } catch (err) {
            console.error("Failed to view moment:", err);
        }
    },

    hasActiveMoment: (userId) => {
        const moments = get().moments;
        return moments.some(m => m.userId?._id === userId || m.userId === userId);
    }
}));
