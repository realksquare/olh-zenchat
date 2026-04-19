const admin = require("firebase-admin");

let isFirebaseInitialized = false;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // You'll need to set FIREBASE_SERVICE_ACCOUNT_KEY to the base64 encoded JSON string of your service account
        // or path to service account json
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('ascii')
        );
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        isFirebaseInitialized = true;
    } else {
        console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is not set. Push notifications will not be sent.");
    }
} catch (error) {
    console.error("Firebase admin initialization error:", error);
}

const User = require("../models/User");

const sendPushNotification = async (userId, fcmToken, title, body, data = {}) => {
    if (!isFirebaseInitialized || !fcmToken) return;

    try {
        const message = {
            notification: {
                title,
                body,
            },
            data,
            token: fcmToken,
            webpush: {
                headers: {
                    Urgency: "high"
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log("Successfully sent message:", response);
    } catch (error) {
        console.error("Error sending message:", error);
        if (error.errorInfo?.code === 'messaging/registration-token-not-registered') {
            console.log(`Token unregistered for user ${userId}. Clearing from DB...`);
            if (userId) {
                await User.findByIdAndUpdate(userId, { fcmToken: "" }).exec();
            }
        }
    }
};

module.exports = {
    sendPushNotification
};
