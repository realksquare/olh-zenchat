const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const RECENT_LIMIT = 21;

// GET /api/user-media/recents  - get user's recent GIFs/stickers
router.get("/recents", async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("recentMedia");
        res.json({ recentMedia: user?.recentMedia || [] });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/user-media/recents  - add a GIF/sticker to recents (with de-dup, capped at 21)
router.post("/recents", async (req, res) => {
    try {
        const { url, mediaType } = req.body;
        if (!url) return res.status(400).json({ message: "url required" });

        const type = mediaType || "gif";
        const user = await User.findById(req.user._id);

        let recents = user.recentMedia || [];

        // Remove existing entry with same URL (de-dup by moving to front)
        recents = recents.filter(m => m.url !== url);

        // Prepend
        recents.unshift({ url, mediaType: type });

        // Cap at RECENT_LIMIT
        if (recents.length > RECENT_LIMIT) {
            recents = recents.slice(0, RECENT_LIMIT);
        }

        await User.findByIdAndUpdate(req.user._id, { recentMedia: recents });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// GET /api/user-media/favorites  - get user's favorite GIFs/stickers
router.get("/favorites", async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("favoriteMedia");
        res.json({ favoriteMedia: user?.favoriteMedia || [] });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/user-media/favorites  - toggle a GIF/sticker as favorite
router.post("/favorites", async (req, res) => {
    try {
        const { url, mediaType } = req.body;
        if (!url) return res.status(400).json({ message: "url required" });

        const type = mediaType || "gif";
        const user = await User.findById(req.user._id);
        const favs = user.favoriteMedia || [];

        const existingIndex = favs.findIndex(m => m.url === url);

        if (existingIndex !== -1) {
            // Already favorited — remove it (toggle off)
            favs.splice(existingIndex, 1);
            await User.findByIdAndUpdate(req.user._id, { favoriteMedia: favs });
            return res.json({ success: true, isFavorited: false });
        } else {
            // Add to favorites (prepend, no duplicate)
            favs.unshift({ url, mediaType: type });
            await User.findByIdAndUpdate(req.user._id, { favoriteMedia: favs });
            return res.json({ success: true, isFavorited: true });
        }
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// DELETE /api/user-media/favorites  - remove a specific URL from favorites
router.delete("/favorites", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ message: "url required" });

        const user = await User.findById(req.user._id);
        const favs = (user.favoriteMedia || []).filter(m => m.url !== url);
        await User.findByIdAndUpdate(req.user._id, { favoriteMedia: favs });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
