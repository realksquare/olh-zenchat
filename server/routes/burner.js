const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const BurnerBridge = require("../models/BurnerBridge");
const BurnerMessage = require("../models/BurnerMessage");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "zenchat-burner-secret-key-fallback";

/**
 * Helper to authenticate either a registered ZenChat user or a burner guest session
 */
const bridgeAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === "guest") {
            req.isGuest = true;
            req.guestSession = decoded;
            return next();
        }

        // Standard user token
        const user = await User.findById(decoded._id).select("_id username isSuspended");
        if (!user || user.isSuspended) {
            return res.status(401).json({ message: "Invalid user session" });
        }
        req.user = decoded;
        req.isGuest = false;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired session" });
    }
};

/**
 * POST /api/burner/create
 * Authenticated creator generates a new ephemeral burner bridge
 */
router.post("/create", authMiddleware, async (req, res) => {
    try {
        const { durationHours = 24, maxMessages = 0, creatorAlias } = req.body;
        const validHours = Math.max(1, Math.min(Number(durationHours) || 24, 72));
        const expiresAt = new Date(Date.now() + validHours * 60 * 60 * 1000);

        const bridgeToken = crypto.randomBytes(12).toString("hex");

        const user = await User.findById(req.user._id).select("username");
        const hostAlias = (creatorAlias && creatorAlias.trim()) || user?.username || "Host";

        const bridge = await BurnerBridge.create({
            bridgeToken,
            creatorId: req.user._id,
            creatorAlias: hostAlias,
            durationHours: validHours,
            expiresAt,
            maxMessages: Math.max(0, Number(maxMessages) || 0),
            status: "active",
        });

        res.status(201).json({
            success: true,
            bridge: {
                bridgeToken: bridge.bridgeToken,
                creatorAlias: bridge.creatorAlias,
                durationHours: bridge.durationHours,
                expiresAt: bridge.expiresAt,
                maxMessages: bridge.maxMessages,
                status: bridge.status,
                createdAt: bridge.createdAt,
            },
        });
    } catch (err) {
        console.error("[Burner] Error creating bridge:", err);
        res.status(500).json({ message: "Failed to create burner bridge" });
    }
});

/**
 * GET /api/burner/my-bridges
 * Authenticated creator retrieves their active burner bridges
 */
router.get("/my-bridges", authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const bridges = await BurnerBridge.find({
            creatorId: req.user._id,
            status: "active",
            expiresAt: { $gt: now },
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            bridges: bridges.map((b) => ({
                id: b._id,
                bridgeToken: b.bridgeToken,
                creatorAlias: b.creatorAlias,
                guestAlias: b.guestAlias,
                guestConnected: Boolean(b.guestSessionId),
                durationHours: b.durationHours,
                expiresAt: b.expiresAt,
                maxMessages: b.maxMessages,
                messageCount: b.messageCount,
                createdAt: b.createdAt,
            })),
        });
    } catch (err) {
        console.error("[Burner] Error fetching user bridges:", err);
        res.status(500).json({ message: "Failed to fetch burner bridges" });
    }
});

/**
 * GET /api/burner/:token/preview
 * Public preview endpoint to check bridge validity and expiry
 */
router.get("/:token/preview", async (req, res) => {
    try {
        const { token } = req.params;
        const bridge = await BurnerBridge.findOne({ bridgeToken: token });

        if (!bridge) {
            return res.status(404).json({ valid: false, message: "Burner bridge not found." });
        }

        if (bridge.status === "burned") {
            return res.json({
                valid: false,
                status: "burned",
                burnReason: bridge.burnReason,
                message: "This bridge has burned into ash. Zero messages or logs remain.",
            });
        }

        if (new Date() >= bridge.expiresAt) {
            if (bridge.status !== "expired") {
                bridge.status = "expired";
                bridge.burnReason = "time_expired";
                await bridge.save();
                await BurnerMessage.deleteMany({ bridgeToken: token });
            }
            return res.json({
                valid: false,
                status: "expired",
                message: "This bridge session has expired and all messages were destroyed.",
            });
        }

        res.json({
            valid: true,
            status: "active",
            bridgeToken: bridge.bridgeToken,
            creatorAlias: bridge.creatorAlias,
            guestAlias: bridge.guestAlias,
            hasGuestJoined: Boolean(bridge.guestSessionId),
            expiresAt: bridge.expiresAt,
            durationHours: bridge.durationHours,
            maxMessages: bridge.maxMessages,
            messageCount: bridge.messageCount,
        });
    } catch (err) {
        console.error("[Burner] Preview error:", err);
        res.status(500).json({ message: "Failed to preview burner bridge" });
    }
});

/**
 * POST /api/burner/:token/join
 * Guest enters bridge with a casual alias, receives temporary guest session token
 */
router.post("/:token/join", async (req, res) => {
    try {
        const { token } = req.params;
        const { guestAlias } = req.body;

        const bridge = await BurnerBridge.findOne({ bridgeToken: token });
        if (!bridge) {
            return res.status(404).json({ message: "Burner bridge not found." });
        }

        if (bridge.status !== "active" || new Date() >= bridge.expiresAt) {
            return res.status(410).json({ message: "This burner bridge is no longer active." });
        }

        const chosenAlias = (guestAlias && guestAlias.trim()) || `ZenGuest#${Math.floor(100 + Math.random() * 900)}`;
        const guestSessionId = crypto.randomUUID();

        bridge.guestAlias = chosenAlias;
        bridge.guestSessionId = guestSessionId;
        await bridge.save();

        const guestSessionToken = jwt.sign(
            {
                bridgeToken: token,
                guestSessionId,
                role: "guest",
                alias: chosenAlias,
            },
            JWT_SECRET,
            { expiresIn: "72h" }
        );

        res.json({
            success: true,
            guestSessionToken,
            guestSessionId,
            guestAlias: chosenAlias,
            bridge: {
                bridgeToken: bridge.bridgeToken,
                creatorAlias: bridge.creatorAlias,
                expiresAt: bridge.expiresAt,
                maxMessages: bridge.maxMessages,
                messageCount: bridge.messageCount,
            },
        });
    } catch (err) {
        console.error("[Burner] Join error:", err);
        res.status(500).json({ message: "Failed to join burner bridge" });
    }
});

/**
 * GET /api/burner/:token/messages
 * Retrieves encrypted message history for this active bridge
 */
router.get("/:token/messages", bridgeAuth, async (req, res) => {
    try {
        const { token } = req.params;
        const bridge = await BurnerBridge.findOne({ bridgeToken: token });

        if (!bridge || bridge.status !== "active") {
            return res.status(410).json({ message: "Bridge is inactive or burned." });
        }

        const messages = await BurnerMessage.find({ bridgeToken: token })
            .sort({ createdAt: 1 })
            .select("senderType senderAlias senderId content iv type createdAt");

        res.json({
            success: true,
            messages,
        });
    } catch (err) {
        console.error("[Burner] Fetch messages error:", err);
        res.status(500).json({ message: "Failed to load messages" });
    }
});

/**
 * POST /api/burner/:token/burn
 * Triggers instant self-destruction of the bridge and purges all DB messages
 */
router.post("/:token/burn", bridgeAuth, async (req, res) => {
    try {
        const { token } = req.params;
        const bridge = await BurnerBridge.findOne({ bridgeToken: token });

        if (!bridge) {
            return res.status(404).json({ message: "Bridge not found." });
        }

        bridge.status = "burned";
        bridge.burnReason = "manual_burn";
        await bridge.save();

        // Purge all messages from database immediately
        await BurnerMessage.deleteMany({ bridgeToken: token });

        // Broadcast to all sockets connected to this burner bridge
        const io = req.app.get("io");
        if (io) {
            io.of("/burner").to(`burner:${token}`).emit("burner_destroyed", {
                bridgeToken: token,
                burnReason: "manual_burn",
                message: "Bridge self-destructed. All messages wiped from server memory.",
            });
        }

        res.json({
            success: true,
            message: "Burner bridge incinerated into ash. All records erased.",
        });
    } catch (err) {
        console.error("[Burner] Burn error:", err);
        res.status(500).json({ message: "Failed to burn bridge" });
    }
});

module.exports = router;
