const cron = require('node-cron');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const Moment = require('../models/Moment');
const User = require('../models/User');
const { sendPushNotification } = require('./firebase');

const startCronJobs = () => {
    // Run daily at midnight: '0 0 * * *'
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log("[Cron] Running 21-Day Auto-Purge job...");
            
            // Cutoff: Only apply to messages sent ON OR AFTER May 26, 2026
            const cutoffStart = new Date('2026-05-26T00:00:00.000Z');
            
            // Delete messages older than 21 days
            const purgeThreshold = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
            
            const query = {
                createdAt: {
                    $gte: cutoffStart,
                    $lte: purgeThreshold
                },
                type: { $in: ['text', 'gif', 'sticker'] }, // Excludes image, video, file, voice
                $or: [
                    { starredBy: { $exists: false } },
                    { starredBy: { $size: 0 } }
                ]
            };

            const result = await Message.deleteMany(query);
            console.log(`[Cron] 21-Day Auto-Purge complete. Deleted ${result.deletedCount} text messages.`);
        } catch (err) {
            console.error("[Cron] Auto-Purge job failed:", err);
        }
    });
    
    console.log("[Cron] Auto-Purge job scheduled to run daily at midnight.");

    // Daily Digest at 8 PM (20:00 server time)
    cron.schedule('0 20 * * *', async () => {
        try {
            console.log("[Cron] Running 8 PM Daily Digest job...");
            const usersWithTokens = await User.find({ "fcmTokens.0": { $exists: true } }).lean();

            for (const user of usersWithTokens) {
                const userChats = await Chat.find({ participants: user._id }).select('_id').lean();
                const chatIds = userChats.map(c => c._id);

                const unreadMsgsCount = await Message.countDocuments({
                    chatId: { $in: chatIds },
                    senderId: { $ne: user._id },
                    status: { $ne: "read" }
                });

                const unviewedMomentsCount = await Moment.countDocuments({
                    userId: { $ne: user._id },
                    expiresAt: { $gt: new Date() },
                    "viewedBy.userId": { $ne: user._id }
                });

                if (unreadMsgsCount > 0 || unviewedMomentsCount > 0) {
                    const parts = [];
                    if (unreadMsgsCount > 0) parts.push(`${unreadMsgsCount} unread message${unreadMsgsCount > 1 ? 's' : ''}`);
                    if (unviewedMomentsCount > 0) parts.push(`${unviewedMomentsCount} unviewed #Moment${unviewedMomentsCount > 1 ? 's' : ''}`);

                    const bodyText = `You have ${parts.join(' and ')} waiting for you!`;

                    for (const tokenData of user.fcmTokens) {
                        await sendPushNotification(
                            user._id,
                            tokenData.token,
                            "ZenChat Daily Digest",
                            bodyText,
                            { type: "daily_digest" }
                        );
                    }
                }
            }
            console.log("[Cron] 8 PM Daily Digest complete.");
        } catch (err) {
            console.error("[Cron] Daily Digest job failed:", err);
        }
    });

    console.log("[Cron] Daily Digest job scheduled to run at 8 PM.");
};

module.exports = { startCronJobs };
