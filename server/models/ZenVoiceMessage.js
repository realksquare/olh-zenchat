const mongoose = require("mongoose");

const zenVoiceMessageSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "ZenVoiceRoom", required: true },
    pseudonym: { type: String, required: true },
    pseudonymAvatarColor: { type: String, default: "" },
    content: { type: String, required: true, maxlength: 1000 },
    type: {
        type: String,
        enum: ["text", "image", "gif", "sticker", "doc"],
        default: "text"
    },
    mediaUrl: { type: String, default: null },
    restrictedBy: [{ type: String }],
    globalBlur: { type: Boolean, default: false },
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor: [{ type: String }],
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ZenVoiceMessage", default: null },
    isEdited: { type: Boolean, default: false },
    starredBy: [{ type: String }],
    deletedAt: { type: Date, default: null },
    appealStatus: {
        type: String,
        enum: ['none', 'pending', 'rejected', 'approved'],
        default: 'none'
    },
    createdAt: { type: Date, default: Date.now }
});

// TTL index: MongoDB removes docs where deletedAt has passed
zenVoiceMessageSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ZenVoiceMessage", zenVoiceMessageSchema);
