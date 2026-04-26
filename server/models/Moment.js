const mongoose = require("mongoose");

const momentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["text", "image", "video", "music"],
            default: "text",
        },
        content: {
            type: String,
            default: "",
        },
        mediaUrl: {
            type: String,
            default: "",
        },
        music: {
            title: String,
            artist: String,
            previewUrl: String,
            coverUrl: String,
            duration: Number,
            startTime: Number
        },
        viewedBy: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                at: { type: Date, default: Date.now }
            }
        ],
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 86400, // 24 hours in seconds (TTL Index)
        },
    },
    { timestamps: true }
);

// Index for performance
momentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Moment", momentSchema);
