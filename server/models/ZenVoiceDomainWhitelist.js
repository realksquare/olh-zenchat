const mongoose = require("mongoose");

const zenVoiceDomainWhitelistSchema = new mongoose.Schema({
    domain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    institutionName: { type: String, required: true },
    organizationType: {
        type: String,
        enum: ["academic", "corporate", "agency", "community", "other"],
        default: "academic"
    },
    country: { type: String, default: "" },
    status: {
        type: String,
        enum: ["approved", "pending", "rejected"],
        default: "pending"
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ZenVoiceDomainWhitelist", zenVoiceDomainWhitelistSchema);
