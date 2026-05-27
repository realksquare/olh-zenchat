const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        chatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chat",
            required: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String,
            default: "",
            trim: true,
        },
        type: {
            type: String,
            enum: ["text", "image", "voice", "video", "file", "gif", "sticker"],
            default: "text",
        },
        status: {
            type: String,
            enum: ["sent", "delivered", "read"],
            default: "sent",
        },
        mediaUrl: {
            type: String,
            default: "",
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        editedAt: {
            type: Date,
        },
        deletedForEveryone: {
            type: Boolean,
            default: false,
        },
        deletedFor: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        starredBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        isViewOnce: {
            type: Boolean,
            default: false,
        },
        viewedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        cid: {
            type: String,
            default: null,
        },
        disappearingMode: {
            type: String,
            default: "off"
        },
        expiresAt: {
            type: Date,
            default: null
        },
        isEncrypted: {
            type: Boolean,
            default: false
        },
        encryptedSymmetricKey: {
            type: String,
            default: ""
        },
        iv: {
            type: String,
            default: ""
        },
        isLowBandwidth: {
            type: Boolean,
            default: false
        },
        isZenMessage: {
            type: Boolean,
            default: false
        },
        reactions: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                emoji: {
                    type: String,
                    required: true,
                },
            }
        ],
        waveform: {
            type: String,
            default: ""
        }
    },
    { timestamps: true }
);

messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Message", messageSchema);