const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verify user still exists in DB and is not suspended
        const user = await User.findById(decoded._id).select("_id isSuspended");
        if (!user) {
            return res.status(401).json({ message: "Account no longer exists" });
        }
        
        if (user.isSuspended) {
            return res.status(403).json({ message: "Your account has been suspended" });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

module.exports = authMiddleware;