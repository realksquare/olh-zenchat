const express = require("express");
const router = express.Router();
const Moment = require("../models/Moment");
const User = require("../models/User");
const protect = require("../middleware/auth");

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
        
        const populated = await Moment.findById(moment._id).populate("userId", "username avatar");
        
        console.log(`[Moments] New moment exhaled by ${req.user.username} (${req.user._id}). Type: ${type}`);
        
        // Emit to contacts
        const io = req.app.get("io");
        const user = await User.findById(req.user._id).select("contacts");
        const contactIds = user.contacts.map(c => c.userId.toString());
        
        // Emit to the user themselves (for other tabs)
        io.to(req.user._id.toString()).emit("new_moment", populated);
        
        // Emit to each online contact
        contactIds.forEach(cid => {
            io.to(cid).emit("new_moment", populated);
        });

        res.status(201).json(populated);
    } catch (err) {
        console.error(`[Moments] Error exhaling moment:`, err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   GET /api/moments
// @desc    Get moments from contacts (that haven't been viewed yet)
router.get("/", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const contactIds = user.contacts.map(c => c.userId);
        
        // Find moments from self (all) or contacts (unviewed)
        const moments = await Moment.find({
            $or: [
                { userId: req.user._id },
                { 
                    userId: { $in: contactIds },
                    "viewedBy.userId": { $ne: req.user._id }
                }
            ]
        })
        .populate("userId", "username avatar")
        .sort({ createdAt: -1 });

        res.json(moments);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/moments/:id/view
// @desc    Mark a moment as viewed (One-Breath rule)
router.post("/:id/view", protect, async (req, res) => {
    try {
        const moment = await Moment.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { viewedBy: { userId: req.user._id } } },
            { new: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
