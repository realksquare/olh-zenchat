import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
let messaging;

try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
} catch (err) {
    console.error("Firebase initialization error", err);
}

export const storage = getStorage(app);
export { ref, uploadBytesResumable, getDownloadURL };

export const requestNotificationPermission = async () => {
    try {
        if (!messaging) return null;
        
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
                console.error("VITE_FIREBASE_VAPID_KEY is missing from environment variables!");
            }
            const registration = await navigator.serviceWorker.ready;
            const token = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration,
            });
            return token;
        } else {
            console.warn("Notification permission denied");
            return null;
        }
    } catch (err) {
        console.error("An error occurred while retrieving token: ", err);
        return null;
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

export const onMessageListener = () =>
    new Promise((resolve) => {
        if (!messaging) return;
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
