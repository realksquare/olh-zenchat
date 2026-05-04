const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");

let spotifyToken = null;
let tokenExpiresAt = 0;

const getSpotifyToken = async () => {
    const now = Date.now();
    if (spotifyToken && now < tokenExpiresAt) {
        return spotifyToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return null;
    }

    try {
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        });

        const data = await response.json();
        if (data.access_token) {
            spotifyToken = data.access_token;
            tokenExpiresAt = now + data.expires_in * 1000 - 60000;
            return spotifyToken;
        }
    } catch (e) {
        console.error("Spotify Auth Error:", e.message);
    }
    return null;
};

const searchITunes = async (q) => {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=25`);
        const data = await response.json();
        return (data.results || []).map(track => ({
            id: `itunes-${track.trackId}`,
            title: track.trackName,
            artist: track.artistName,
            previewUrl: track.previewUrl,
            coverUrl: track.artworkUrl100,
            totalDuration: Math.floor(track.trackTimeMillis / 1000),
            source: "iTunes"
        }));
    } catch (e) {
        return [];
    }
};

// @route   GET /api/music/search?q=...
router.get("/search", protect, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ message: "Query required" });

        const [token, itunesResults] = await Promise.all([
            getSpotifyToken(),
            searchITunes(q)
        ]);

        let spotifyResults = [];
        if (token) {
            try {
                const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=25`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.tracks && data.tracks.items) {
                    spotifyResults = data.tracks.items.map(track => ({
                        id: `spotify-${track.id}`,
                        title: track.name,
                        artist: track.artists.map(a => a.name).join(", "),
                        previewUrl: track.preview_url,
                        coverUrl: track.album.images[0]?.url || "",
                        totalDuration: Math.floor(track.duration_ms / 1000),
                        source: "Spotify"
                    }));
                }
            } catch (err) {
                console.error("Spotify search error:", err.message);
            }
        }

        // Interleave results to mix them nicely
        const combined = [];
        const maxLen = Math.max(spotifyResults.length, itunesResults.length);
        for (let i = 0; i < maxLen; i++) {
            if (spotifyResults[i]) combined.push(spotifyResults[i]);
            if (itunesResults[i]) combined.push(itunesResults[i]);
        }

        res.json(combined);
    } catch (err) {
        console.error("Music search error:", err.message);
        const fallback = await searchITunes(req.query.q);
        res.json(fallback);
    }
});

module.exports = router;
