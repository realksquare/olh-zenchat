const mongoose = require("mongoose");

const zenPulseVoteSchema = new mongoose.Schema(
    {
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ZenPulseQuestion",
            required: true
        },
        voterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        guestToken: {
            type: String,
            default: null
        },
        guestIp: {
            type: String,
            default: null
        },
        optionId: {
            type: String,
            required: true
        },
        referredBy: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

// Prevent duplicate votes per user/question
zenPulseVoteSchema.index({ questionId: 1, voterId: 1 }, { unique: true, partialFilterExpression: { voterId: { $ne: null } } });

// Prevent duplicate votes per guest/question
zenPulseVoteSchema.index({ questionId: 1, guestToken: 1 }, { unique: true, partialFilterExpression: { guestToken: { $ne: null } } });

// Auto-delete guest votes after 30 days (optional, to keep DB lean)
// Wait, we need to keep votes for accurate counting, but counts are tallied in ZenPulseQuestion.
// We'll leave them to ensure people don't re-vote after 30 days, or we can use TTL just on guest tokens.
// Let's not TTL votes for now to ensure data integrity for referral stats and analytics.

module.exports = mongoose.model("ZenPulseVote", zenPulseVoteSchema);
