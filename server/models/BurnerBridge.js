const mongoose = require("mongoose");

const burnerBridgeSchema = new mongoose.Schema(
    {
        bridgeToken: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        creatorAlias: {
            type: String,
            default: "Host",
            trim: true,
        },
        guestAlias: {
            type: String,
            default: "Guest",
            trim: true,
        },
        guestSessionId: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ["active", "burned", "expired"],
            default: "active",
            index: true,
        },
        burnReason: {
            type: String,
            enum: ["manual_burn", "time_expired", "message_limit_reached", null],
            default: null,
        },
        durationHours: {
            type: Number,
            default: 24,
            min: 1,
            max: 72,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
        maxMessages: {
            type: Number,
            default: 0, // 0 means unlimited
        },
        messageCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Auto-expire documents after expiresAt has passed (MongoDB TTL index)
burnerBridgeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("BurnerBridge", burnerBridgeSchema);
