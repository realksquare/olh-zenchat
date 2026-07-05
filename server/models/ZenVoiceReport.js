const mongoose = require("mongoose");

const zenVoiceReportSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "ZenVoiceRoom" },
    reportedPseudonym: { type: String, required: true },
    reporterPseudonym: { type: String, required: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: "ZenVoiceMessage" },
    reason: {
        type: String,
        enum: ["harassment", "spam", "hate_speech", "other"],
        required: true
    },
    evidence: { type: String, default: "" },
    status: {
        type: String,
        enum: ["pending", "upheld", "dismissed"],
        default: "pending"
    },
    counterReporterPseudonym: { type: String, default: null },
    counterReportReason: { type: String, default: "" },
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    adminNote: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ZenVoiceReport", zenVoiceReportSchema);
