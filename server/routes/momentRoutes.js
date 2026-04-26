const express = require("express");
const router = express.Router();
const Moment = require("../models/Moment");
const User = require("../models/User");
const protect = require("../middleware/auth");
const { sendPushNotification } = require("../utils/firebase");

router.post("/", protect, async (req, res) => {
    try {
        const { type, content, mediaUrl, music } = req.body;
        const moment = await Moment.create({
            userId: req.user._id,
            type,
            content,
            mediaUrl,
            music
        });

        const populated = await Moment.findById(moment._id).populate("userId", "username avatar fullName");

        console.log(`[moments] New moment shared by ${req.user.username} (${req.user._id}). Type: ${type}`);

        const io = req.app.get("io");
        const user = await User.findById(req.user._id).select("contacts username fullName avatar");
        const contactIds = user.contacts.map(c => c.userId.toString());

        // Emit to the user themselves
        io.to(req.user._id.toString()).emit("new_moment", populated);

        // Emit to each online contact and send push notification
        const notificationTitle = `${user.username} has shared a #moment.!`;
        const notificationBody = ""; // Simplified as requested

        contactIds.forEach(async (cid) => {
            io.to(cid).emit("new_moment", populated);

            // Send Push Notif to contacts
            try {
                console.log(`[moments] Sending push to ${cid}. Title: "${notificationTitle}", Body: "${notificationBody}"`);
                const contact = await User.findById(cid).select("fcmTokens");
                if (contact && contact.fcmTokens?.length > 0) {
                    contact.fcmTokens.forEach(t => {
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

        const contactIds = user.contacts.map(c => c.userId);
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
        res.json({ message: "Moment let go." });
    } catch (err) {
        console.error("[moments] Let-go error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
