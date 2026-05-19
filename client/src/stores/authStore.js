import { create } from "zustand";
import { persist } from "zustand/middleware";
import axiosInstance from "../utils/axios";
import { db, clearLocalData } from "../db/zenDB";
import { setupE2EEForUser } from "../utils/e2eeHelper";

const TOKEN_KEY = "zenchat_token";
const USER_KEY = "zenchat_user";

export const useAuthStore = create(
    persist(
        (set) => ({
    token: localStorage.getItem(TOKEN_KEY) || null,
    user: JSON.parse(localStorage.getItem(USER_KEY)) || null,
    isLoading: false,
    error: null,
    soundEnabled: true,
    tempRecoveryKey: null,
    mfaRequired: false,
    mfaType: null,
    mfaUserId: null,
    mfaMaskedValue: null,

    clearTempRecoveryKey: () => set({ tempRecoveryKey: null }),

    register: async (username, email, password, referredBy) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/auth/register", {
                username,
                email,
                password,
                referredBy
            });
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            if (db?.settings) {
                await db.settings.put({ key: "token", value: data.token });
                await db.settings.put({ key: "apiUrl", value: import.meta.env.VITE_API_URL || "" });
            }

            // Securely setup E2EE keys on registration
            let recoveryKey = null;
            try {
                recoveryKey = await setupE2EEForUser(data.user, password);
            } catch (e2eeErr) {
                console.error("[AuthStore] E2EE key registration failed:", e2eeErr);
            }

            set({ token: data.token, user: data.user, tempRecoveryKey: recoveryKey, isLoading: false });
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
            
            if (data.mfaRequired) {
                set({
                    mfaRequired: true,
                    mfaType: data.mfaType,
                    mfaUserId: data.userId,
                    mfaMaskedValue: data.phoneMasked || data.emailMasked,
                    isLoading: false
                });
                return { success: true, mfaRequired: true, mfaType: data.mfaType, userId: data.userId };
            }

            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            if (db?.settings) {
                await db.settings.put({ key: "token", value: data.token });
                await db.settings.put({ key: "apiUrl", value: import.meta.env.VITE_API_URL || "" });
            }

            // Sync E2EE keys on login
            let recoveryKey = null;
            try {
                recoveryKey = await setupE2EEForUser(data.user, password);
            } catch (e2eeErr) {
                console.error("[AuthStore] E2EE key sync failed:", e2eeErr);
            }

            set({ token: data.token, user: data.user, tempRecoveryKey: recoveryKey, isLoading: false, mfaRequired: false, mfaType: null });
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || "Login failed";
            set({ error: message, isLoading: false });
            return { success: false, message };
        }
    },

    registerPhone: async (username, phoneNumber) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/auth/register/phone", {
                username,
                phoneNumber
            });
            set({ isLoading: false });
            return { success: true, userId: data.userId };
        } catch (err) {
            const message = err.response?.data?.message || "Registration failed";
            set({ error: message, isLoading: false });
            return { success: false, message };
        }
    },

    loginPhone: async (phoneNumber) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/auth/login/phone", { phoneNumber });
            set({ isLoading: false });
            return { success: true, userId: data.userId };
        } catch (err) {
            const message = err.response?.data?.message || "Phone login failed";
            set({ error: message, isLoading: false });
            return { success: false, message };
        }
    },

    verifyOtp: async (userId, otpCode, firebaseToken) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/auth/verify-otp", { userId, otpCode, firebaseToken });
            
            if (data.mfaRequired) {
                set({
                    mfaRequired: true,
                    mfaType: data.mfaType,
                    mfaUserId: data.userId,
                    mfaMaskedValue: data.emailMasked || data.phoneMasked,
                    isLoading: false
                });
                return { success: true, mfaRequired: true, mfaType: data.mfaType, userId: data.userId };
            }

            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            if (db?.settings) {
                await db.settings.put({ key: "token", value: data.token });
                await db.settings.put({ key: "apiUrl", value: import.meta.env.VITE_API_URL || "" });
            }

            // Setup E2EE for Phone registration (Without password, E2EE private key is encrypted under recoveryKey only!)
            let recoveryKey = null;
            try {
                recoveryKey = await setupE2EEForUser(data.user, null);
            } catch (e2eeErr) {
                console.error("[AuthStore] Phone E2EE setup failed:", e2eeErr);
            }

            set({
                token: data.token,
                user: data.user,
                tempRecoveryKey: recoveryKey,
                isLoading: false,
                mfaRequired: false,
                mfaType: null
            });
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || "OTP Verification failed";
            set({ error: message, isLoading: false });
            return { success: false, message };
        }
    },

    verify2faOtp: async (userId, otpCode, firebaseToken) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/auth/verify-2fa-otp", { userId, otpCode, firebaseToken });
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            if (db?.settings) {
                await db.settings.put({ key: "token", value: data.token });
                await db.settings.put({ key: "apiUrl", value: import.meta.env.VITE_API_URL || "" });
            }

            let recoveryKey = null;
            try {
                recoveryKey = await setupE2EEForUser(data.user, null);
            } catch (e2eeErr) {
                console.error("[AuthStore] MFA E2EE setup/sync failed:", e2eeErr);
            }

            set({
                token: data.token,
                user: data.user,
                tempRecoveryKey: recoveryKey,
                isLoading: false,
                mfaRequired: false,
                mfaType: null,
                mfaUserId: null,
                mfaMaskedValue: null
            });
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || "MFA OTP verification failed";
            set({ error: message, isLoading: false });
            return { success: false, message };
        }
    },

    resetMfaState: () => {
        set({
            mfaRequired: false,
            mfaType: null,
            mfaUserId: null,
            mfaMaskedValue: null,
            error: null
        });
    },

    triggerChallenge: async (userId, recoveryKey) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await axiosInstance.post("/auth/challenge", { userId });
            const { encryptedChallenge, cryptoSalt, encryptedPrivateKeyBackup } = data;

            // Decrypt the private key backup using recovery key
            const { decryptPrivateKeyWithRecoveryKey } = await import("../utils/crypto");
            
            let privateKey;
            try {
                privateKey = await decryptPrivateKeyWithRecoveryKey(
                    encryptedPrivateKeyBackup,
                    recoveryKey,
                    cryptoSalt
                );
            } catch (cryptoErr) {
                throw new Error("Invalid E2EE recovery key or decryption failure");
            }

            // Hex decoder
            const hexToBytes = (hex) => {
                const bytes = new Uint8Array(hex.length / 2);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
                }
                return bytes;
            };
            
            const encryptedChallengeBytes = hexToBytes(encryptedChallenge);

            // Decrypt challenge
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "RSA-OAEP" },
                privateKey,
                encryptedChallengeBytes
            );

            const decryptedChallenge = new TextDecoder().decode(decryptedBuffer);

            // Verify decrypted challenge
            const verifyRes = await axiosInstance.post("/auth/verify-challenge", {
                userId,
                decryptedChallenge
            });

            const finalData = verifyRes.data;
            localStorage.setItem(TOKEN_KEY, finalData.token);
            localStorage.setItem(USER_KEY, JSON.stringify(finalData.user));
            const { db } = await import("../db/zenDB");
            if (db?.settings) {
                await db.settings.put({ key: "token", value: finalData.token });
                await db.settings.put({ key: "apiUrl", value: import.meta.env.VITE_API_URL || "" });
            }

            // Secure key cache in IndexedDB
            try {
                const privateKeyJWK = await window.crypto.subtle.exportKey("jwk", privateKey);
                if (db?.keys) {
                    await db.keys.put({ key: "privateKey", value: privateKeyJWK });
                    await db.keys.put({ key: "publicKey", value: finalData.user.publicKey });
                    await db.keys.put({ key: "recoveryKey", value: recoveryKey });
                    await db.keys.put({ key: "recoveryKeySaved", value: "true" });
                }
            } catch (cacheErr) {
                console.error("[AuthStore] Cache E2EE key during bypass failed:", cacheErr);
            }

            set({
                token: finalData.token,
                user: finalData.user,
                isLoading: false,
                mfaRequired: false,
                mfaType: null,
                mfaUserId: null,
                mfaMaskedValue: null
            });
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || err.message || "Decryption bypass verification failed";
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
        try {
            await clearLocalData();
        } catch (dbErr) {
            console.error("[AuthStore] Clear IndexedDB failed:", dbErr);
        }
        set({ token: null, user: null, error: null });
    },

    checkAuth: async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;
        try {
            const { data } = await axiosInstance.get("/auth/me");
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            if (db?.settings) {
                await db.settings.put({ key: "token", value: token });
                await db.settings.put({ key: "apiUrl", value: import.meta.env.VITE_API_URL || "" });
            }
            set({ user: data.user, token });
        } catch (err) {
            console.error("Auth check failed:", err);
            if (err.response?.status === 401) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
                set({ token: null, user: null });
            }
        }
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

        toggleSound: () => {
            set((s) => ({ soundEnabled: !s.soundEnabled }));
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

        blockUser: async (targetUserId) => {
            set({ isLoading: true, error: null });
            try {
                const { data } = await axiosInstance.post(`/auth/block/${targetUserId}`);
                localStorage.setItem("zenchat_user", JSON.stringify(data.user));
                set({ user: data.user, isLoading: false });
                return { success: true, user: data.user };
            } catch (err) {
                const message = err.response?.data?.message || "Failed to block user";
                set({ error: message, isLoading: false });
                return { success: false, message };
            }
        },

        unblockUser: async (targetUserId) => {
            set({ isLoading: true, error: null });
            try {
                const { data } = await axiosInstance.post(`/auth/unblock/${targetUserId}`);
                localStorage.setItem("zenchat_user", JSON.stringify(data.user));
                set({ user: data.user, isLoading: false });
                return { success: true, user: data.user };
            } catch (err) {
                const message = err.response?.data?.message || "Failed to unblock user";
                set({ error: message, isLoading: false });
                return { success: false, message };
            }
        },
    }),
    {
        name: "zenchat-auth",
    }
));