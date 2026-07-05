const cron = require('node-cron');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const Moment = require('../models/Moment');
const User = require('../models/User');
const { sendPushNotification } = require('./firebase');

const startCronJobs = (io) => {
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

    // Hourly check for Daily Digest at 8 PM local time
    cron.schedule('0 * * * *', async () => {
        try {
            console.log("[Cron] Checking Daily Digest for users at 8 PM local time...");
            const usersWithTokens = await User.find({ "fcmTokens.0": { $exists: true } });

            for (const user of usersWithTokens) {
                if (!user.timezone) continue;

                try {
                    const userTime = new Date().toLocaleString("en-US", { timeZone: user.timezone, hour12: false, hour: 'numeric' });
                    const currentHour = parseInt(userTime, 10);

                    if (currentHour === 20) {
                        const userDateStr = new Date().toLocaleString("en-US", { timeZone: user.timezone, year: 'numeric', month: 'numeric', day: 'numeric' });
                        
                        let alreadySentToday = false;
                        if (user.lastDailyDigestSent) {
                            const lastSentDateStr = new Date(user.lastDailyDigestSent).toLocaleString("en-US", { timeZone: user.timezone, year: 'numeric', month: 'numeric', day: 'numeric' });
                            if (lastSentDateStr === userDateStr) {
                                alreadySentToday = true;
                            }
                        }

                        if (!alreadySentToday) {
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
                                        { type: "daily_digest", tag: "daily-digest" }
                                    );
                                }
                                
                                user.lastDailyDigestSent = new Date();
                                await user.save();
                            }
                        }
                    }
                } catch (tzErr) {
                    // Invalid timezone string or other format error for this user
                    console.error(`[Cron] Timezone check failed for user ${user._id}:`, tzErr);
                }
            }
            console.log("[Cron] Hourly Daily Digest check complete.");
        } catch (err) {
            console.error("[Cron] Daily Digest job failed:", err);
        }
    });

    console.log("[Cron] Daily Digest job scheduled to run hourly.");

    // ZenPulse Daily Question Activator at 13:30 UTC / 7:00 PM IST
    cron.schedule('30 13 * * *', async () => {
        try {
            console.log("[Cron] Running ZenPulse Activator...");
            const ZenPulseQuestion = require("../models/ZenPulseQuestion");
            
            // 1. Mark current active as revealed
            const currentActive = await ZenPulseQuestion.findOne({ status: "active" });
            if (currentActive) {
                currentActive.status = "revealed";
                currentActive.revealedAt = new Date();
                await currentActive.save();
            }

            // 2. Find next scheduled
            const now = new Date();
            const nextScheduled = await ZenPulseQuestion.findOne({ 
                status: "scheduled",
                scheduledFor: { $lte: now }
            }).sort({ scheduledFor: 1 });

            if (nextScheduled) {
                nextScheduled.status = "active";
                nextScheduled.activatedAt = new Date();
                await nextScheduled.save();

                // Send push notification to everyone
                console.log("[Cron] Sending ZenPulse push notifications...");
                const usersWithTokens = await User.find({ "fcmTokens.0": { $exists: true } });
                for (const user of usersWithTokens) {
                    for (const tokenData of user.fcmTokens) {
                        await sendPushNotification(
                            user._id,
                            tokenData.token,
                            "ZenPulse",
                            "Today's question is live - cast your vote!",
                            { type: "zen_pulse", url: "/zenpulse", tag: "zen-pulse" }
                        );
                    }
                }
                console.log(`[Cron] ZenPulse push sent to ${usersWithTokens.length} users.`);
            } else {
                console.warn("[Cron] No scheduled ZenPulse questions available to activate!");
            }
        } catch (err) {
            console.error("[Cron] ZenPulse Activator failed:", err);
        }
    });

    // ZenPulse Question Bank Monitor at 08:00 UTC
    cron.schedule('0 8 * * *', async () => {
        try {
            const ZenPulseQuestion = require("../models/ZenPulseQuestion");
            const count = await ZenPulseQuestion.countDocuments({ status: "scheduled" });
            if (count < 3) {
                console.warn(`[Cron] ZenPulse Warning: Only ${count} scheduled questions left in queue.`);
            }
        } catch (err) {
            console.error("[Cron] ZenPulse Bank Monitor failed:", err);
        }
    });

    // ─── ZenVoice Cron Jobs ──────────────────────────────────────────────────

    // 1. ZenVoice 7:30 AM warning (30 min before 8 AM hard purge)
    cron.schedule('30 7 * * *', async () => {
        if (!io) return;
        try {
            console.log("[Cron] Sending ZenVoice 8 AM reset warning...");
            const ZenVoiceRoom = require("../models/ZenVoiceRoom");
            const activeRooms = await ZenVoiceRoom.find({ isActive: true });
            activeRooms.forEach(room => {
                io.of("/zenvoice").to(room._id.toString()).emit("room_reset_countdown", { minutesLeft: 30 });
            });
        } catch (err) {
            console.error("[Cron] ZenVoice 8 AM warning failed:", err);
        }
    });

    // 2. ZenVoice 8:00 AM Hard Purge (updates deletedAt to now for TTL purge)
    cron.schedule('0 8 * * *', async () => {
        if (!io) return;
        try {
            console.log("[Cron] Running ZenVoice 8 AM hard purge...");
            const ZenVoiceRoom = require("../models/ZenVoiceRoom");
            const ZenVoiceMessage = require("../models/ZenVoiceMessage");
            const rooms = await ZenVoiceRoom.find({});

            for (const room of rooms) {
                io.of("/zenvoice").to(room._id.toString()).emit("purge_lockdown_start");
                await ZenVoiceMessage.updateMany({ roomId: room._id, deletedAt: null }, { deletedAt: new Date() });
                await ZenVoiceRoom.findByIdAndUpdate(room._id, { lastActivityAt: new Date() });
                io.of("/zenvoice").to(room._id.toString()).emit("room_reset");
                io.of("/zenvoice").to(room._id.toString()).emit("purge_lockdown_end");
            }
        } catch (err) {
            console.error("[Cron] ZenVoice 8 AM purge failed:", err);
        }
    });

    // 3. ZenVoice 30-Minute Idle Purge (runs every 5 mins, active post-8 PM only)
    cron.schedule('*/5 * * * *', async () => {
        if (!io) return;
        try {
            const hour = new Date().getHours();
            if (hour < 20) return; // post-8 PM local server time only

            console.log("[Cron] Running ZenVoice post-8 PM idle check...");
            const ZenVoiceRoom = require("../models/ZenVoiceRoom");
            const ZenVoiceMessage = require("../models/ZenVoiceMessage");

            const idleThreshold = new Date(Date.now() - 30 * 60 * 1000);
            const warningThreshold = new Date(Date.now() - 25 * 60 * 1000);

            // Purge idle rooms
            const idleRooms = await ZenVoiceRoom.find({
                isActive: true,
                lastActivityAt: { $lt: idleThreshold }
            });
            for (const room of idleRooms) {
                await ZenVoiceMessage.updateMany({ roomId: room._id, deletedAt: null }, { deletedAt: new Date() });
                io.of("/zenvoice").to(room._id.toString()).emit("room_reset");
                console.log(`[Cron] ZenVoice room ${room._id} reset due to 30-min inactivity.`);
            }

            // Warning for rooms approaching idle
            const warningRooms = await ZenVoiceRoom.find({
                isActive: true,
                lastActivityAt: { $lt: warningThreshold, $gte: idleThreshold }
            });
            warningRooms.forEach(room => {
                io.of("/zenvoice").to(room._id.toString()).emit("room_idle_warning", { minutesLeft: 5 });
            });
        } catch (err) {
            console.error("[Cron] ZenVoice idle check failed:", err);
        }
    });
};

module.exports = { startCronJobs };
