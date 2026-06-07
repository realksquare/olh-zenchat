const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const ZenPulseQuestion = require("../models/ZenPulseQuestion");
const ZenPulseVote = require("../models/ZenPulseVote");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Helper to check admin access
const adminCheck = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user || (user.role !== "co_admin" && user.role !== "master_admin")) {
            return res.status(403).json({ message: "Admin access denied" });
        }
        req.adminUser = user;
        next();
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Rate limiter for guest voting
const rateLimit = require("express-rate-limit");
const guestVoteLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hrs
    max: 2, // Max 2 attempts per IP per 24 hours (for testing we can be slightly lenient, or strictly 1)
    message: { message: "Too many voting attempts from this IP." },
    standardHeaders: true,
    legacyHeaders: false,
});

/* ========================================================
   PUBLIC ENDPOINTS
   ======================================================== */

// Get today's active question
router.get("/today", async (req, res) => {
    try {
        const activeQuestion = await ZenPulseQuestion.findOne({ status: "active" }).select("-optionCounts -totalVotes");
        if (!activeQuestion) {
            return res.json({ question: null });
        }
        res.json({ question: activeQuestion });
    } catch (err) {
        console.error("GET /today error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get yesterday's revealed question
router.get("/yesterday", async (req, res) => {
    try {
        // Find the most recently revealed question
        const lastRevealed = await ZenPulseQuestion.findOne({ status: "revealed" }).sort({ revealedAt: -1 });
        if (!lastRevealed) {
            return res.json({ question: null });
        }
        res.json({ question: lastRevealed });
    } catch (err) {
        console.error("GET /yesterday error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Record a referral link click (redirects to /zenpulse?ref=username)
router.get("/ref-click/:username", async (req, res) => {
    try {
        const username = req.params.username;
        if (username) {
            await User.updateOne({ username }, { $inc: { "referralStats.clicks": 1 } });
        }
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/zenpulse?ref=${username}`);
    } catch (err) {
        console.error("GET /ref-click error:", err);
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/zenpulse`);
    }
});

// Guest vote submission
router.post("/vote/guest", guestVoteLimiter, async (req, res) => {
    try {
        const { questionId, optionId, fingerprint, referredBy } = req.body;
        if (!questionId || !optionId || !fingerprint) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const activeQuestion = await ZenPulseQuestion.findOne({ _id: questionId, status: "active" });
        if (!activeQuestion) {
            return res.status(400).json({ message: "This question is not currently active." });
        }

        if (!activeQuestion.options.find(o => o.id === optionId)) {
            return res.status(400).json({ message: "Invalid option selected." });
        }

        const guestIp = crypto.createHash("sha256").update(req.ip || req.connection.remoteAddress).digest("hex");
        const guestToken = crypto.createHmac("sha256", process.env.JWT_SECRET || "fallback_secret")
                                 .update(`${questionId}_${fingerprint}`)
                                 .digest("hex");

        // Check if this fingerprint has already voted for this question
        const existingVote = await ZenPulseVote.findOne({ questionId, guestToken });
        if (existingVote) {
            return res.status(400).json({ message: "You have already voted on this question." });
        }

        const newVote = new ZenPulseVote({
            questionId,
            guestToken,
            guestIp,
            optionId,
            referredBy: referredBy || null
        });

        await newVote.save();

        // Increment counts in the question document safely
        const updateQuery = { $inc: { totalVotes: 1 } };
        updateQuery.$inc[`optionCounts.${optionId}`] = 1;
        await ZenPulseQuestion.updateOne({ _id: questionId }, updateQuery);

        res.json({ success: true, message: "Vote recorded." });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "You have already voted on this question." });
        }
        console.error("POST /vote/guest error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ========================================================
   AUTHENTICATED ENDPOINTS
   ======================================================== */

// Get user's status and history
router.get("/my-status", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("pulseStreak pulseVotedQuestions");
        
        const activeQuestion = await ZenPulseQuestion.findOne({ status: "active" }).select("_id");
        let myVote = null;
        if (activeQuestion) {
            myVote = await ZenPulseVote.findOne({ questionId: activeQuestion._id, voterId: user._id }).select("optionId questionId");
        }

        res.json({
            streak: user.pulseStreak,
            myVote,
            votedQuestionIds: user.pulseVotedQuestions || []
        });
    } catch (err) {
        console.error("GET /my-status error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Authenticated vote submission
router.post("/vote", authMiddleware, async (req, res) => {
    try {
        const { questionId, optionId, guestTokenToMerge } = req.body;
        if (!questionId || !optionId) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const activeQuestion = await ZenPulseQuestion.findOne({ _id: questionId, status: "active" });
        if (!activeQuestion) {
            return res.status(400).json({ message: "This question is not currently active." });
        }

        if (!activeQuestion.options.find(o => o.id === optionId)) {
            return res.status(400).json({ message: "Invalid option selected." });
        }

        const user = await User.findById(req.user._id);

        let existingVote = await ZenPulseVote.findOne({ questionId, voterId: user._id });
        
        // If they just registered, they might have a guest token vote to link
        if (!existingVote && guestTokenToMerge) {
             const guestVote = await ZenPulseVote.findOne({ questionId, guestToken: guestTokenToMerge, voterId: null });
             if (guestVote) {
                 guestVote.voterId = user._id;
                 guestVote.guestToken = null; // Remove guest token to finalize link
                 await guestVote.save();
                 existingVote = guestVote;
             }
        }

        if (existingVote) {
            return res.status(400).json({ message: "You have already voted on this question." });
        }

        const newVote = new ZenPulseVote({
            questionId,
            voterId: user._id,
            optionId
        });

        await newVote.save();

        // Increment counts
        const updateQuery = { $inc: { totalVotes: 1 } };
        updateQuery.$inc[`optionCounts.${optionId}`] = 1;
        await ZenPulseQuestion.updateOne({ _id: questionId }, updateQuery);

        // Update User Streak
        const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD UTC
        let currentStreak = user.pulseStreak?.current || 0;
        let longestStreak = user.pulseStreak?.longest || 0;
        
        if (user.pulseStreak?.lastVotedDate) {
            const lastVoted = new Date(user.pulseStreak.lastVotedDate);
            const todayDate = new Date(todayStr);
            const diffDays = Math.floor((todayDate - lastVoted) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                currentStreak += 1;
            } else if (diffDays > 1) {
                currentStreak = 1;
            }
            // if diffDays === 0, they already got streak credit, but they shouldn't be able to vote again anyway
        } else {
            currentStreak = 1;
        }

        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
        }

        user.pulseStreak = {
            current: currentStreak,
            longest: longestStreak,
            lastVotedDate: todayStr
        };

        if (!user.pulseVotedQuestions) user.pulseVotedQuestions = [];
        user.pulseVotedQuestions.push(questionId);

        await user.save();

        res.json({ success: true, message: "Vote recorded.", streak: user.pulseStreak });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "You have already voted on this question." });
        }
        console.error("POST /vote error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get history (paginated)
router.get("/history", authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 7;
        const skip = (page - 1) * limit;

        const questions = await ZenPulseQuestion.find({ status: "revealed" })
            .sort({ revealedAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const total = await ZenPulseQuestion.countDocuments({ status: "revealed" });

        res.json({
            questions,
            hasMore: skip + questions.length < total
        });
    } catch (err) {
        console.error("GET /history error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ========================================================
   ADMIN ENDPOINTS
   ======================================================== */

// Get all questions
router.get("/admin/questions", authMiddleware, adminCheck, async (req, res) => {
    try {
        const questions = await ZenPulseQuestion.find().sort({ scheduledFor: -1 }).populate("createdBy", "username");
        
        const today = new Date();
        today.setHours(0,0,0,0);
        const votesToday = await ZenPulseVote.countDocuments({ createdAt: { $gte: today } });
        
        res.json({ questions, stats: { votesToday } });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Create scheduled question
router.post("/admin/questions", authMiddleware, adminCheck, async (req, res) => {
    try {
        const { question, options, category, scheduledFor } = req.body;
        
        const newQuestion = new ZenPulseQuestion({
            question,
            options,
            category,
            scheduledFor: new Date(scheduledFor),
            createdBy: req.user._id
        });

        await newQuestion.save();
        res.status(201).json({ question: newQuestion });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "A question is already scheduled for this date." });
        }
        res.status(500).json({ message: "Server error" });
    }
});

// Edit scheduled question
router.put("/admin/questions/:id", authMiddleware, adminCheck, async (req, res) => {
    try {
        const { question, options, category, scheduledFor } = req.body;
        const q = await ZenPulseQuestion.findById(req.params.id);
        
        if (!q) return res.status(404).json({ message: "Not found" });
        if (q.status !== "scheduled") return res.status(400).json({ message: "Can only edit scheduled questions" });

        q.question = question;
        q.options = options;
        q.category = category;
        q.scheduledFor = new Date(scheduledFor);

        await q.save();
        res.json({ question: q });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "A question is already scheduled for this date." });
        }
        res.status(500).json({ message: "Server error" });
    }
});

// Delete scheduled question
router.delete("/admin/questions/:id", authMiddleware, adminCheck, async (req, res) => {
    try {
        const q = await ZenPulseQuestion.findById(req.params.id);
        if (!q) return res.status(404).json({ message: "Not found" });
        if (q.status !== "scheduled") return res.status(400).json({ message: "Can only delete scheduled questions" });

        await ZenPulseQuestion.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Force activate current question manually (helper for testing/admin)
router.post("/admin/force-activate", authMiddleware, adminCheck, async (req, res) => {
    try {
        // Find current active and reveal it
        const currentActive = await ZenPulseQuestion.findOne({ status: "active" });
        if (currentActive) {
            currentActive.status = "revealed";
            currentActive.revealedAt = new Date();
            await currentActive.save();
        }

        // Find next scheduled and activate it
        const nextScheduled = await ZenPulseQuestion.findOne({ status: "scheduled" }).sort({ scheduledFor: 1 });
        if (nextScheduled) {
            nextScheduled.status = "active";
            nextScheduled.activatedAt = new Date();
            await nextScheduled.save();
        }

        res.json({ success: true, message: "Forced activation of next question." });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
