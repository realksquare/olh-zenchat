const mongoose = require("mongoose");

const zenVoiceRoomSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 60 },
    description: { type: String, default: "", maxlength: 200 },
    creatorPseudonym: { type: String, required: true },
    isOfficial: { type: Boolean, default: false },
    allowedDomain: { type: String, default: "" },
    inviteToken: { type: String, default: null },
    members: [{ type: String }],
    memberCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ZenVoiceRoom", zenVoiceRoomSchema);
