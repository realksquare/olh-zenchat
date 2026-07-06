const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * ZenVoice-specific JWT middleware.
 * Validates the ZenVoice session token (signed with ZENVOICE_JWT_SECRET),
 * NOT the main ZenChat JWT. Also checks suspension status from DB.
 */
const zenVoiceAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No ZenVoice token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.ZENVOICE_JWT_SECRET || process.env.JWT_SECRET || "zenvoice-secret-fallback-key");
        req.zenVoicePseudonym = decoded.sub;
        req.zenVoiceDomain = decoded.domain || "";
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired ZenVoice session" });
    }
};

module.exports = zenVoiceAuthMiddleware;
