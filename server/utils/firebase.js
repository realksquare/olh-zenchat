const admin = require("firebase-admin");

const path = require("path");
const fs = require("fs");

let isFirebaseInitialized = false;

try {
    const localKeyPath = path.join(__dirname, "../serviceAccountKey.json");
    if (fs.existsSync(localKeyPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        isFirebaseInitialized = true;
        console.log("[Firebase] Successfully initialized using local serviceAccountKey.json");
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
        );
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        isFirebaseInitialized = true;
        console.log("[Firebase] Successfully initialized using environment base64 key");
    } else {
        console.warn("[Firebase] Warning: Firebase Admin credentials not found. Real-time services (FCM/OTP) will fall back to mock systems.");
    }
} catch (error) {
    console.error("[Firebase] Initialization error:", error.message);
}

const User = require("../models/User");

const sendPushNotification = async (userId, fcmToken, title, body, data = {}) => {
    if (!isFirebaseInitialized || !fcmToken) return;

    const stringData = {};
    for (const [k, v] of Object.entries(data)) {
        stringData[k] = String(v);
    }

    const message = {
        token: fcmToken,
        notification: {
            title: String(title),
            body: String(body),
        },
        data: stringData,
        webpush: {
            headers: { Urgency: "high" },
            notification: {
                title: String(title),
                body: String(body),
                icon: "/favicon.svg",
                badge: "/favicon.svg",
                tag: "zenchat-notif",
                renotify: true,
            },
            fcm_options: {}
        },
        android: {
            priority: "high",
        },
        apns: {
            headers: { "apns-priority": "10" },
        }
    };

    try {
        console.log(`[Push] Attempting FCM send to token: ${fcmToken.substring(0, 10)}...`);
        const response = await admin.messaging().send(message);
        console.log(`[Push] FCM Send Success. Response:`, response);
        return true;
    } catch (error) {
        console.error(`[Push] FCM Send Error for token ${fcmToken.substring(0, 10)}...:`, error.message);
        if (error.errorInfo?.code === 'messaging/registration-token-not-registered') {
            console.log(`[Push] Token not registered. Cleaning up...`);
            if (userId) {
                await User.findByIdAndUpdate(userId, { 
                    $pull: { fcmTokens: { token: fcmToken } } 
                }).exec();
            }
        }
        return false;
    }
};

const verifyFirebaseIdToken = async (idToken) => {
    if (!isFirebaseInitialized) {
        throw new Error("Firebase Admin is not initialized.");
    }
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
};

module.exports = { sendPushNotification, verifyFirebaseIdToken };
