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

// Deezer search without authentication
const searchDeezer = async (q) => {
    try {
        const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=25`);
        const data = await res.json();
        if (data && data.data) {
            return data.data.map(track => ({
                id: `deezer-${track.id}`,
                title: track.title,
                artist: track.artist.name,
                previewUrl: track.preview,
                coverUrl: track.album.cover_medium || "",
                totalDuration: track.duration, // duration is in seconds
                source: "Deezer"
            }));
        }
    } catch (e) {
        console.error("Deezer search error:", e.message);
    }
    return [];
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

        const [deezerResults, itunesResults] = await Promise.all([
            searchDeezer(q),
            searchITunes(q)
        ]);

        // Interleave results to mix them nicely
        const combined = [];
        const maxLen = Math.max(deezerResults.length, itunesResults.length);
        for (let i = 0; i < maxLen; i++) {
            if (deezerResults[i]) combined.push(deezerResults[i]);
            if (itunesResults[i]) combined.push(itunesResults[i]);
        }

        res.json(combined);
    } catch (err) {
        console.error("Music search error:", err.message);
        const fallback = await searchITunes(req.query.q);
        res.json(fallback);
    }
});

// @route   GET /api/music/proxy?url=...
// Proxies Deezer/iTunes CDN audio to bypass browser CORS restrictions
router.get("/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).end();

    // Allowlist only known music preview CDN domains
    const ALLOWED_DOMAINS = [
        'dzcdn.net',
        'itunes.apple.com',
        'music.apple.com',
        'mzstatic.com',
        'audio-ssl.itunes.apple.com'
    ];
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        const allowed = ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
        if (!allowed) return res.status(403).end();
    } catch {
        return res.status(400).end();
    }

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
            'Accept': 'audio/mpeg, audio/*, */*',
            'Referer': 'https://www.deezer.com/',
        };
        if (req.headers.range) headers['Range'] = req.headers.range;

        const upstream = await fetch(url, { headers });

        if (!upstream.ok && upstream.status !== 206) {
            return res.status(upstream.status).end();
        }

        res.status(upstream.status);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Accept-Ranges', 'bytes');

        const contentLength = upstream.headers.get('content-length');
        if (contentLength) res.setHeader('Content-Length', contentLength);

        const contentRange = upstream.headers.get('content-range');
        if (contentRange) res.setHeader('Content-Range', contentRange);

        // Stream the audio
        const { Readable } = require('stream');
        if (upstream.body && upstream.body.getReader) {
            const nodeStream = Readable.fromWeb(upstream.body);
            nodeStream.pipe(res);
            nodeStream.on('error', () => { if (!res.headersSent) res.status(500).end(); });
        } else {
            const buffer = await upstream.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (err) {
        console.error("Music proxy error:", err.message);
        if (!res.headersSent) res.status(500).end();
    }
});

module.exports = router;
