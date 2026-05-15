const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
    {
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
        ],
        isGroup: {
            type: Boolean,
            default: false,
        },
        groupName: {
            type: String,
            default: "",
            trim: true,
        },
        groupAvatar: {
            type: String,
            default: "",
        },
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        deletedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            }
        ],
        pinnedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            }
        ],
        disappearingMode: {
            type: String,
            enum: ["off", "instant", "1h", "8h", "24h", "7d"],
            default: "off"
        },
    },
    { timestamps: true }
);

chatSchema.index({ participants: 1 });

module.exports = mongoose.model("Chat", chatSchema);