import { create } from "zustand";
import { persist } from "zustand/middleware";
import axiosInstance from "../utils/axios";

const TOKEN_KEY = "zenchat_token";
const USER_KEY = "zenchat_user";

export const useAuthStore = create(
    persist(
        (set) => ({
    token: localStorage.getItem(TOKEN_KEY) || null,
    user: JSON.parse(localStorage.getItem(USER_KEY)) || null,
    isLoading: false,
    error: null,

    register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/auth/register", {
                username,
                email,
                password,
            });
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            set({ token: data.token, user: data.user, isLoading: false });
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || "Registration failed";
            set({ error: message, isLoading: false });
            return { success: false, message };
        }
    },

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/auth/login", { email, password });
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            set({ token: data.token, user: data.user, isLoading: false });
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || "Login failed";
            set({ error: message, isLoading: false });
            return { success: false, message };
        }
    },

    logout: async () => {
        try {
            const token = localStorage.getItem(TOKEN_KEY);
            await axiosInstance.post(
                "/auth/logout",
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (_) { }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        set({ token: null, user: null, error: null });
    },

    clearError: () => set({ error: null }),

    updateProfile: async (formData) => {
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem(TOKEN_KEY);
            const { data } = await axiosInstance.put("/auth/me", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            set({ user: data.user, isLoading: false });
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || "Profile update failed";
            set({ error: message, isLoading: false });
            return { success: false, message };
        }
    },

        updateUser: (updatedUser) => {
            set({ user: updatedUser });
        },

        toggleContact: async (targetUserId) => {
            const { user } = useAuthStore.getState();
            if (!user) return;
            const isContact = user.contacts?.some(c => c.userId?.toString() === targetUserId || c.userId === targetUserId);
            try {
                const { data } = isContact
                    ? await axiosInstance.delete(`/auth/contacts/${targetUserId}`)
                    : await axiosInstance.post(`/auth/contacts/${targetUserId}`);
                localStorage.setItem("zenchat_user", JSON.stringify(data.user));
                set({ user: data.user });
                return data.user;
            } catch (err) {
                console.error("Failed to toggle contact:", err);
            }
        },
    }),
    {
        name: "zenchat-auth",
    }
));