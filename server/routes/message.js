const express = require("express");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const authMiddleware = require("../middleware/auth");
const { uploadMedia } = require("../utils/cloudinary");

const router = express.Router();

router.get("/test-cloudinary", (req, res) => {
    const envCheck = {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "SET" : "MISSING",
        api_key: process.env.CLOUDINARY_API_KEY ? "SET" : "MISSING",
        api_secret: process.env.CLOUDINARY_API_SECRET ? "SET" : "MISSING"
    };
    res.send(`
        <h1>Cloudinary Diagnostic</h1>
        <pre>${JSON.stringify(envCheck, null, 2)}</pre>
        <p>If you see this, the route is working. Next, try to ping Cloudinary below:</p>
        <form action="/api/messages/ping-cloudinary" method="POST">
            <button type="submit">Ping Cloudinary API</button>
        </form>
    `);
});

router.post("/ping-cloudinary", async (req, res) => {
    try {
        const { cloudinary } = require("../utils/cloudinary");
        const result = await cloudinary.api.ping();
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.use(authMiddleware);

router.get("/:chatId", async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.chatId,
            participants: req.user._id,
        });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        const messages = await Message.find({
            chatId: req.params.chatId,
            deletedFor: { $nin: [req.user._id] },
        })
            .populate("senderId", "username avatar")
            .populate("replyTo")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Mark messages from others as read when fetching history
        await Message.updateMany(
            { 
                chatId: req.params.chatId, 
                senderId: { $ne: req.user._id }, 
                status: { $ne: "read" } 
            },
            { status: "read" }
        );

        res.json({ messages: messages.reverse() });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:chatId/upload", (req, res, next) => {
    uploadMedia.single("file")(req, res, (err) => {
        if (err) {
            console.error("[Upload] Error caught in middleware:", err);
            return res.status(500).json({ 
                message: "Upload middleware failed", 
                error: err.message,
                code: err.code
            });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });
        res.json({ mediaUrl: req.file.path });
    } catch (err) {
        console.error("[Upload] Route handler error:", err);
        res.status(500).json({ message: "Server error during upload completion" });
    }
});

router.post("/:chatId", async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.chatId,
            participants: req.user._id,
        });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        const { content, type, mediaUrl, replyTo, isViewOnce } = req.body;

        if (!content && !mediaUrl) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        const message = await Message.create({
            chatId: req.params.chatId,
            senderId: req.user._id,
            content,
            type: type || "text",
            mediaUrl: mediaUrl || "",
            replyTo: replyTo || null,
            isViewOnce: isViewOnce === true || isViewOnce === "true",
        });

        await Chat.findByIdAndUpdate(req.params.chatId, {
            lastMessage: message._id,
            updatedAt: new Date(),
        });

        const populated = await Message.findById(message._id)
            .populate("senderId", "username avatar")
            .populate("replyTo");

        res.status(201).json({ message: populated });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.patch("/:chatId/read", async (req, res) => {
    try {
        await Message.updateMany(
            {
                chatId: req.params.chatId,
                senderId: { $ne: req.user._id },
                status: { $ne: "read" },
            },
            { status: "read" }
        );

        res.json({ message: "Messages marked as read" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:messageId/star", async (req, res) => {
    try {
        await Message.findByIdAndUpdate(req.params.messageId, {
            $addToSet: { starredBy: req.user._id }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:messageId/unstar", async (req, res) => {
    try {
        await Message.findByIdAndUpdate(req.params.messageId, {
            $pull: { starredBy: req.user._id }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:messageId/view", async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (message && message.isViewOnce && !message.viewedBy.includes(req.user._id)) {
            await Message.findByIdAndUpdate(req.params.messageId, {
                $addToSet: { viewedBy: req.user._id }
            });
            // Optional: If both participants have viewed (in 1-on-1), we could delete it, 
            // but for now we just mark it as viewed on the client.
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/:messageId", async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.deletedFor.includes(req.user._id)) {
            return res.status(400).json({ message: "Already deleted" });
        }

        await Message.findByIdAndUpdate(req.params.messageId, {
            $push: { deletedFor: req.user._id },
        });

        res.json({ message: "Message deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;