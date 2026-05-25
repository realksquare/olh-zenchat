const cron = require('node-cron');
const Message = require('../models/Message');

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
};

module.exports = { startCronJobs };
