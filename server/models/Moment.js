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
            trackId: String,
            source: String,
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
        },
        caption: {
            type: String,
            default: "",
        },
        locationTag: {
            type: String,
            default: "",
        },
        filter: {
            type: String,
            default: "none",
        },
        disappearAfterHours: {
            type: Number,
            default: 24,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
    },
    { timestamps: true }
);

// Index for performance
momentSchema.index({ userId: 1, createdAt: -1 });
momentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Moment", momentSchema);
