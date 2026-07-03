import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDuPbl1-IEdxnDctJgELm_VAQoSrLvWEM8",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "olh-zenchat.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "olh-zenchat",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "olh-zenchat.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "598009129757",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:598009129757:web:5c20c07e1864c88778cff4",
};

let app;
let messaging;
let auth;

try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    auth = getAuth(app);
} catch (err) {
    console.error("Firebase initialization error", err);
}

export const storage = getStorage(app);
export { ref, uploadBytesResumable, getDownloadURL, auth };

export const requestNotificationPermission = async () => {
    try {
        if (!messaging) throw new Error("Firebase messaging is not initialized.");
        
        if (!('serviceWorker' in navigator)) {
            throw new Error("Service workers are not supported (requires HTTPS or localhost).");
        }

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
                console.error("VITE_FIREBASE_VAPID_KEY is missing from environment variables!");
            }
            
            let registration;
            try {
                // Ensure a SW is registered — if none exists yet, register the FCM SW.
                // navigator.serviceWorker.ready resolves with the active SW registration once ready.
                const existing = await navigator.serviceWorker.getRegistration('/');
                if (!existing) {
                    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                }
                registration = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Service Worker timeout")), 8000))
                ]);
            } catch (swErr) {
                console.error("Service worker registration failed:", swErr);
                throw new Error("Failed to register Service Worker. Please clear cache and try again.");
            }

            try {
                const tokenOptions = { serviceWorkerRegistration: registration };
                if (import.meta.env.VITE_FIREBASE_VAPID_KEY) {
                    tokenOptions.vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
                }
                const token = await getToken(messaging, tokenOptions);
                return token;
            } catch (tokenErr) {
                console.error("Token generation failed:", tokenErr);
                throw new Error("Push token generation failed. Check your Firebase VAPID key config.");
            }
        } else {
            console.warn("Notification permission denied");
            throw new Error("Notification permission denied by user.");
        }
    } catch (err) {
        console.error("An error occurred while retrieving token: ", err);
        throw err;
    }
};
export const disableNotificationPermission = async () => {
    try {
        if (!messaging) return false;
        await deleteToken(messaging);
        return true;
    } catch (err) {
        console.error("Error deleting FCM token:", err);
        return false;
    }
};

export const setupForegroundNotifications = () => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
        // If document is not visible, show a system notification (desktop workaround)
        if (document.visibilityState !== 'visible') {
            let newTitle = payload.data?.title || payload.notification?.title || 'New Message';
            let newBody = payload.data?.body || payload.notification?.body || '';

            if (payload.data?.isViewOnce === "true") {
                newBody = "Image - Sent a view-once media";
            }
            
            const notification = new Notification(newTitle, {
                body: newBody,
                icon: '/notif-icon.svg',
                badge: '/notif-badge.svg',
                tag: payload.data?.tag || payload.notification?.tag || 'zenchat-notif',
                data: {
                    url: payload.fcmOptions?.link || payload.data?.url || '/',
                    chatId: payload.data?.chatId,
                }
            });
            
            notification.onclick = (event) => {
                window.focus();
                const chatId = event.target.data?.chatId;
                if (chatId) {
                    window.dispatchEvent(new CustomEvent("open-chat-from-notif", { detail: chatId }));
                }
            };
        }
    });
};
