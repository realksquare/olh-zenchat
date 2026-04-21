const admin = require("firebase-admin");

let isFirebaseInitialized = false;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
        );
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        isFirebaseInitialized = true;
        console.log("[Firebase] Admin SDK initialized successfully.");
    } else {
        console.warn("[Firebase] FIREBASE_SERVICE_ACCOUNT_KEY not set - push notifications disabled.");
    }
} catch (error) {
    console.error("[Firebase] Admin SDK init error:", error.message);
}

const User = require("../models/User");

/**
 * Send a push notification via FCM HTTP v1
 * @param {string} userId - MongoDB user ID (for token cleanup)
 * @param {string} fcmToken - The recipient's FCM registration token
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {Object} data - Extra key/value data (all values must be strings)
 */
const sendPushNotification = async (userId, fcmToken, title, body, data = {}) => {
    if (!isFirebaseInitialized) {
        console.warn("[Firebase] Skipping push - SDK not initialized.");
        return;
    }
    if (!fcmToken) {
        console.warn(`[Firebase] Skipping push for user ${userId} - no FCM token.`);
        return;
    }

    // Ensure all data values are strings (FCM requirement)
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
            fcm_options: {
                link: "/"
            }
        },
        android: {
            priority: "high",
        },
        apns: {
            headers: { "apns-priority": "10" },
        }
    };

    try {
        const response = await admin.messaging().send(message);
        console.log(`[Firebase] Push sent to user ${userId}:`, response);
        return true;
    } catch (error) {
        console.error(`[Firebase] Error sending push to user ${userId}:`, error.message);
        if (error.errorInfo?.code === 'messaging/registration-token-not-registered') {
            console.log(`[Firebase] Token unregistered - clearing for user ${userId}`);
            if (userId) {
                await User.findByIdAndUpdate(userId, { 
                    $pull: { fcmTokens: { token: fcmToken } } 
                }).exec();
            }
        }
        return false;
    }
};

module.exports = { sendPushNotification };
