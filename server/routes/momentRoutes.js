const express = require("express");
const router = express.Router();
const Moment = require("../models/Moment");
const User = require("../models/User");
const protect = require("../middleware/auth");
const { sendPushNotification } = require("../utils/firebase");
const { onlineUsers } = require("../socket/handlers");

router.post("/", protect, async (req, res) => {
    try {
        const { type, content, mediaUrl, music, caption, locationTag, filter, disappearAfterHours } = req.body;
        const hours = disappearAfterHours ? Number(disappearAfterHours) : 24;
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

        const moment = await Moment.create({
            userId: req.user._id,
            type,
            content,
            mediaUrl,
            music,
            caption: caption || "",
            locationTag: locationTag || "",
            filter: filter || "none",
            disappearAfterHours: hours,
            expiresAt
        });

        const populated = await Moment.findById(moment._id).populate("userId", "username avatar fullName");

        console.log(`[moments] New moment shared by ${req.user.username} (${req.user._id}). Type: ${type}`);

        const io = req.app.get("io");
        const user = await User.findById(req.user._id).select("contacts username fullName avatar blockedUsers");
        
        const usersWhoBlockedMe = await User.find({ "blockedUsers.userId": req.user._id }).select("_id");
        const blockedMeIds = usersWhoBlockedMe.map(u => u._id.toString());
        const myBlockedIds = user.blockedUsers?.map(u => u.userId.toString()) || [];
        const excludeUserIds = [...blockedMeIds, ...myBlockedIds];

        const contactIds = user.contacts
            .map(c => c.userId.toString())
            .filter(cid => !excludeUserIds.includes(cid));

        // Emit to the user themselves
        io.to(req.user._id.toString()).emit("new_moment", populated);

        // Emit to each online contact and send push notification
        const notificationTitle = `${user.username} has shared a #moment.!`;
        const notificationBody = ""; // Simplified as requested

        contactIds.forEach(async (cid) => {
            io.to(cid).emit("new_moment", populated);

            // Send Push Notif to contacts if they are offline
            if (!onlineUsers.has(cid.toString())) {
                try {
                    console.log(`[moments] Sending push to ${cid}. Title: "${notificationTitle}", Body: "${notificationBody}"`);
                    const contact = await User.findById(cid).select("fcmTokens");
                    if (contact && contact.fcmTokens?.length > 0) {
                        const tokens = contact.fcmTokens;
                        const pwaTokens = tokens.filter(t => t.deviceType === "pwa");
                        const browserTokens = tokens.filter(t => t.deviceType === "browser");
                        const targetTokens = pwaTokens.length > 0 ? pwaTokens : browserTokens;

                        targetTokens.forEach(t => {
                            sendPushNotification(cid, t.token, notificationTitle, notificationBody, {
                                icon: user.avatar || "/logo192.png",
                                click_action: "https://olh-zenchat.vercel.app/?tab=moments",
                                tag: `moment-upload-${user._id.toString()}`
                            });
                        });
                    }
                } catch (err) {
                    console.error(`[moments] Notif error for contact ${cid}:`, err);
                }
            }
        });

        res.status(201).json(populated);
    } catch (err) {
        console.error(`[moments] Error sharing moment:`, err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const usersWhoBlockedMe = await User.find({ "blockedUsers.userId": req.user._id }).select("_id");
        const blockedMeIds = usersWhoBlockedMe.map(u => u._id.toString());
        const myBlockedIds = user.blockedUsers?.map(u => u.userId.toString()) || [];
        const excludeUserIds = [...blockedMeIds, ...myBlockedIds];

        const contactIds = user.contacts
            .map(c => c.userId.toString())
            .filter(cid => !excludeUserIds.includes(cid));

        console.log(`[moments] ${user.username} fetching. Contacts found: ${contactIds.length}`);

        const moments = await Moment.find({
            $or: [
                { userId: req.user._id },
                { userId: { $in: contactIds } }
            ]
        })
        .populate("userId", "username avatar fullName")
        .sort({ createdAt: -1 });

        console.log(`[moments] Returning ${moments.length} moments for ${user.username}`);
        res.json(moments);
    } catch (err) {
        console.error(`[moments] Fetch error:`, err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:id/view", protect, async (req, res) => {
    try {
        const moment = await Moment.findById(req.params.id);
        if (!moment) return res.json({ success: true });
        
        // Only add if not the uploader and not already viewed by this user
        const uploaderId = moment.userId.toString();
        const viewerId = req.user._id.toString();
        const alreadyViewed = moment.viewedBy.some(v => v.userId?.toString() === viewerId);
        
        if (uploaderId !== viewerId && !alreadyViewed) {
            await Moment.findByIdAndUpdate(
                req.params.id,
                { $push: { viewedBy: { userId: req.user._id, at: new Date() } } },
                { new: true }
            );
        }
        
        // Return updated moment so client can sync viewedBy immediately
        const updated = await Moment.findById(req.params.id).populate("userId", "username avatar fullName");
        res.json({ success: true, moment: updated });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/:id", protect, async (req, res) => {
    try {
        const moment = await Moment.findById(req.params.id);
        if (!moment) return res.status(404).json({ message: "Moment not found" });

        if (moment.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Not authorized" });
        }

        await moment.deleteOne();
        console.log(`[moments] Moment ${req.params.id} let go by ${req.user.username}`);

        // Notify the uploader + all contacts in real-time
        const io = req.app.get("io");
        if (io) {
            const user = await User.findById(req.user._id).select("contacts");
            const contactIds = (user?.contacts || []).map(c => c.userId.toString());

            // Notify the owner's own sockets (multi-device)
            io.to(req.user._id.toString()).emit("moment_deleted", { momentId: req.params.id });

            // Notify all contacts
            contactIds.forEach(cid => {
                io.to(cid).emit("moment_deleted", { momentId: req.params.id });
            });
        }

        res.json({ message: "Moment let go." });
    } catch (err) {
        console.error("[moments] Let-go error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:id/like", protect, async (req, res) => {
    try {
        const moment = await Moment.findById(req.params.id);
        if (!moment) return res.status(404).json({ message: "Moment not found" });

        const userId = req.user._id.toString();
        const ownerId = moment.userId.toString();

        // Owner cannot like their own moment
        if (userId === ownerId) {
            return res.status(403).json({ message: "You cannot like your own moment" });
        }

        const alreadyLiked = moment.likes.some(id => id.toString() === userId);
        const update = alreadyLiked
            ? { $pull: { likes: req.user._id } }
            : { $addToSet: { likes: req.user._id } };

        const updated = await Moment.findByIdAndUpdate(req.params.id, update, { new: true })
            .populate("userId", "username avatar fullName");

        // Broadcast to owner + all their contacts so like count updates in real-time
        const io = req.app.get("io");
        if (io) {
            const owner = await User.findById(ownerId).select("contacts");
            const contactIds = (owner?.contacts || []).map(c => c.userId.toString());
            const payload = { momentId: req.params.id, likes: updated.likes.map(id => id.toString()) };
            io.to(ownerId).emit("moment_liked", payload);
            contactIds.forEach(cid => io.to(cid).emit("moment_liked", payload));
        }

        // Send Push Notif to the moment owner if they are offline and a new like was added
        if (!alreadyLiked && !onlineUsers.has(ownerId)) {
            try {
                const liker = await User.findById(req.user._id).select("username avatar");
                const ownerUser = await User.findById(ownerId).select("fcmTokens");
                if (ownerUser && ownerUser.fcmTokens?.length > 0) {
                    const notificationTitle = `${liker.username} liked your #moment.!`;
                    const notificationBody = ""; 
                    const tokens = ownerUser.fcmTokens;
                    const pwaTokens = tokens.filter(t => t.deviceType === "pwa");
                    const browserTokens = tokens.filter(t => t.deviceType === "browser");
                    const targetTokens = pwaTokens.length > 0 ? pwaTokens : browserTokens;

                    targetTokens.forEach(t => {
                        sendPushNotification(ownerId, t.token, notificationTitle, notificationBody, {
                            icon: liker.avatar || "/logo192.png",
                            click_action: "https://olh-zenchat.vercel.app/?tab=moments",
                            tag: `moment-like-${req.params.id}`
                        });
                    });
                }
            } catch (err) {
                console.error(`[moments] Like push error for owner ${ownerId}:`, err);
            }
        }

        res.json({ success: true, likes: updated.likes.map(id => id.toString()), liked: !alreadyLiked });
    } catch (err) {
        console.error("[moments] Like error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
