const express = require("express");
const router = express.Router();
const Moment = require("../models/Moment");
const User = require("../models/User");
const protect = require("../middleware/auth");
const { sendPushNotification } = require("../utils/firebase");

// @route   POST /api/moments
// @desc    Create a new moment
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
        let notificationBody = "";
        if (type === "music") notificationBody = `vibe. ${music.title}`;
        else if (content) notificationBody = content;
        else notificationBody = `Shared a new ${type}.`;

        contactIds.forEach(async (cid) => {
            io.to(cid).emit("new_moment", populated);
            
            // Send Push Notif to contacts
            try {
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

// @route   GET /api/moments
// @desc    Get all active moments from self and contacts
router.get("/", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const contactIds = user.contacts.map(c => c.userId);
        
        // Find all active moments from self or contacts (24h rule usually handled by TTL or cleanup, 
        // but here we just fetch whatever is in DB)
        const moments = await Moment.find({
            $or: [
                { userId: req.user._id },
                { userId: { $in: contactIds } }
            ]
        })
        .populate("userId", "username avatar fullName")
        .sort({ createdAt: -1 });

        res.json(moments);
    } catch (err) {
        console.error(`[moments] Fetch error:`, err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/moments/:id/view
// @desc    Mark a moment as viewed
router.post("/:id/view", protect, async (req, res) => {
    try {
        await Moment.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { viewedBy: { userId: req.user._id } } },
            { new: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// @route   DELETE /api/moments/:id
// @desc    Delete a moment (Let go)
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
