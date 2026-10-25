const mongoose = require("mongoose");

const burnerMessageSchema = new mongoose.Schema(
    {
        bridgeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BurnerBridge",
            required: true,
            index: true,
        },
        bridgeToken: {
            type: String,
            required: true,
            index: true,
        },
        senderType: {
            type: String,
            enum: ["creator", "guest", "system"],
            required: true,
        },
        senderAlias: {
            type: String,
            required: true,
        },
        senderId: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true, // Ciphertext in hex
        },
        iv: {
            type: String,
            default: "", // Initialization vector in hex
        },
        type: {
            type: String,
            enum: ["text", "system"],
            default: "text",
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    { timestamps: true }
);

// Auto-purge messages upon bridge expiration
burnerMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
burnerMessageSchema.index({ bridgeToken: 1, createdAt: 1 });

module.exports = mongoose.model("BurnerMessage", burnerMessageSchema);
