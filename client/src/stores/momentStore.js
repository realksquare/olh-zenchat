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
            const res = await axiosInstance.post(`/moments/${momentId}/view`);
            if (res.data?.moment) {
                const updated = res.data.moment;
                set((state) => ({
                    moments: state.moments.map(m =>
                        m._id === momentId || m._id?.toString() === updated._id?.toString()
                            ? { ...m, viewedBy: updated.viewedBy }
                            : m
                    )
                }));
            }
        } catch (err) {}
    },

    deleteMoment: async (momentId) => {
        try {
            await axiosInstance.delete(`/moments/${momentId}`);
            set((state) => ({
                moments: state.moments.filter(m => m._id !== momentId)
            }));
        } catch (err) {
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
        const uid = (userId?._id || userId || '').toString();
        return moments.some(m => (m.userId?._id || m.userId)?.toString() === uid);
    },

    getHaloColor: (userId, currentUserId) => {
        const moments = get().moments;
        const uid = (userId?._id || userId || '').toString();
        const cuid = (currentUserId?._id || currentUserId || '').toString();
        if (!uid) return '#082f49';
        const userMoments = moments.filter(m => (m.userId?._id || m.userId)?.toString() === uid);
        if (userMoments.length === 0) return '#082f49';
        if (uid === cuid) return '#082f49'; // own → sapphire
        const hasUnviewed = userMoments.some(m => {
            const viewedBy = m.viewedBy || [];
            return !viewedBy.some(v => (v.userId?._id || v.userId)?.toString() === cuid);
        });
        return hasUnviewed ? '#10b981' : '#94a3b8'; // emerald → grey
    },

    getViewCount: (momentId, uploaderId) => {
        const moments = get().moments;
        const m = moments.find(m => m._id === momentId || m._id?.toString() === momentId?.toString());
        if (!m) return 0;
        const uid = (uploaderId?._id || uploaderId || '').toString();
        const viewedBy = m.viewedBy || [];
        // unique viewers excluding the uploader
        const unique = new Set(
            viewedBy
                .map(v => (v.userId?._id || v.userId)?.toString())
                .filter(id => id && id !== uid)
        );
        return unique.size;
    },
}));
