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
    }
} catch (error) {
    console.error(error.message);
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
        await admin.messaging().send(message);
        return true;
    } catch (error) {
        if (error.errorInfo?.code === 'messaging/registration-token-not-registered') {
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
