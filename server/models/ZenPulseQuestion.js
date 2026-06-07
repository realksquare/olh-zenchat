const mongoose = require("mongoose");

const zenPulseQuestionSchema = new mongoose.Schema(
    {
        question: {
            type: String,
            required: true,
            maxlength: 200
        },
        options: [
            {
                id: { type: String, required: true },
                text: { type: String, required: true, maxlength: 100 }
            }
        ],
        category: {
            type: String,
            enum: ["General", "Tech", "Life", "This or That"],
            default: "General"
        },
        status: {
            type: String,
            enum: ["scheduled", "active", "revealed"],
            default: "scheduled"
        },
        scheduledFor: {
            type: Date,
            required: true
        },
        activatedAt: {
            type: Date,
            default: null
        },
        revealedAt: {
            type: Date,
            default: null
        },
        totalVotes: {
            type: Number,
            default: 0
        },
        optionCounts: {
            type: Map,
            of: Number,
            default: {}
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

zenPulseQuestionSchema.index({ status: 1, scheduledFor: 1 });
zenPulseQuestionSchema.index({ scheduledFor: 1 }, { unique: true });

module.exports = mongoose.model("ZenPulseQuestion", zenPulseQuestionSchema);
