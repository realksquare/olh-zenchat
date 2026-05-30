const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Load API keys from env (comma-separated), fallback to client-side key
const GIPHY_KEYS = (process.env.GIPHY_API_KEYS || process.env.GIPHY_API_KEY || "pnshJZOMgBP3OVpZzo4TCXPf99zhNIQA")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean);

let currentKeyIndex = 0;

const getNextKey = () => {
    const key = GIPHY_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GIPHY_KEYS.length;
    return key;
};

// Simple in-memory cache: { cacheKey -> { data, expiresAt } }
const cache = new Map();
const CACHE_TTL_TRENDING = 5 * 60 * 1000; // 5 min for trending
const CACHE_TTL_SEARCH   = 2 * 60 * 1000; // 2 min for search results

const getCached = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
};

const setCache = (key, data, ttl) => {
    cache.set(key, { data, expiresAt: Date.now() + ttl });
    // Prevent unbounded growth
    if (cache.size > 200) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
};

router.use(authMiddleware);

// Proxy handler with key rotation on 429
const giphyProxy = async (endpoint, params, res) => {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    const maxAttempts = GIPHY_KEYS.length;
    let lastErr = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const api_key = getNextKey();
        try {
            const queryParams = new URLSearchParams({ ...params, api_key });
            const response = await fetch(`https://api.giphy.com/v1/${endpoint}?${queryParams.toString()}`, {
                signal: AbortSignal.timeout(6000)
            });
            
            if (!response.ok) {
                const error = new Error(`HTTP error! status: ${response.status}`);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            const ttl = params.q ? CACHE_TTL_SEARCH : CACHE_TTL_TRENDING;
            setCache(cacheKey, data, ttl);
            return res.json(data);
        } catch (err) {
            lastErr = err;
            if (err.status === 429) {
                // Rate limited - try next key
                console.warn(`[Giphy] Key ${attempt + 1}/${maxAttempts} hit 429, rotating...`);
                continue;
            }
            break;
        }
    }

    console.error("[Giphy] All keys failed or non-429 error:", lastErr?.message);
    res.status(lastErr?.status || 502).json({ error: "Giphy fetch failed", message: lastErr?.message });
};

// GET /api/giphy/gifs/trending  or  /api/giphy/stickers/trending
router.get("/:type/trending", async (req, res) => {
    const { type } = req.params; // "gifs" or "stickers"
    if (!["gifs", "stickers"].includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
    }
    const { limit = 12, offset = 0, rating = "g" } = req.query;
    await giphyProxy(`${type}/trending`, { limit, offset, rating }, res);
});

// GET /api/giphy/gifs/search?q=...  or  /api/giphy/stickers/search?q=...
router.get("/:type/search", async (req, res) => {
    const { type } = req.params;
    if (!["gifs", "stickers"].includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
    }
    const { q, limit = 12, offset = 0, rating = "g" } = req.query;
    if (!q || !q.trim()) {
        return res.status(400).json({ error: "Search query required" });
    }
    await giphyProxy(`${type}/search`, { q: q.trim(), limit, offset, rating }, res);
});

module.exports = router;
