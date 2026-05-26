const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const User = require("../models/User");
const Moment = require("../models/Moment");
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const mongoose = require("mongoose");

// @route   GET /api/analytics/my-time
// @desc    Get comprehensive "Your Time on ZenChat" stats
// @access  Private
router.get("/my-time", authMiddleware, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).populate("contacts.userId", "username avatar activeTimeMinutes");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // --- 1. Active Chatting Time ---
        const activeTimeGlobal = user.activeTimeMinutes || 0;
        
        let activeTimePerContact = [];
        const contactIdsWithTime = new Set();

        if (user.perContactActiveTime && user.perContactActiveTime.size > 0) {
            for (let [contactId, minutes] of user.perContactActiveTime.entries()) {
                const contact = await User.findById(contactId).select("username avatar");
                if (contact) {
                    const cidStr = contactId.toString();
                    activeTimePerContact.push({
                        contactId: cidStr,
                        username: contact.username,
                        avatar: contact.avatar,
                        minutes
                    });
                    contactIdsWithTime.add(cidStr);
                }
            }
        }

        // Add all other contacts with 0 minutes so they appear in the dashboard filter dropdown
        if (user.contacts && user.contacts.length > 0) {
            for (let c of user.contacts) {
                if (c.userId && c.userId._id) {
                    const cidStr = c.userId._id.toString();
                    if (!contactIdsWithTime.has(cidStr)) {
                        activeTimePerContact.push({
                            contactId: cidStr,
                            username: c.userId.username,
                            avatar: c.userId.avatar,
                            minutes: 0
                        });
                    }
                }
            }
        }

        activeTimePerContact.sort((a, b) => b.minutes - a.minutes);

        // --- 2. Moments Stats ---
        // Moments created by user
        const momentsShared = await Moment.countDocuments({ userId });
        
        // Likes received on own moments
        const myMoments = await Moment.find({ userId }).select("likes");
        let likesReceived = 0;
        myMoments.forEach(m => {
            if (m.likes) likesReceived += m.likes.length;
        });

        // Moments viewed by user (excluding own moments)
        const viewedMoments = await Moment.find({ 
            "viewedBy.userId": userId,
            userId: { $ne: userId }
        });
        const momentsViewed = viewedMoments.length;

        // Moments liked by user
        const momentsLiked = await Moment.countDocuments({ 
            likes: userId,
            userId: { $ne: userId }
        });

        // --- 3. Data Saved ---
        // ZenChat Data Formula Estimate
        // Avg Instagram usage: 150MB/hour
        // Avg WhatsApp/Telegram texting: 2MB/hour
        // By using ZenChat (minimalist), they avoid algorithmic scrolling.
        // We'll calculate hypothetical IG data usage for the same active time.
        const hoursActive = activeTimeGlobal / 60;
        const estimatedGBSaved = (hoursActive * 148) / 1024; // 148MB saved per hour vs IG
        
        const purgedMessages = user.purgedMessagesCount || 0;
        // Assume 2KB per purged message
        const dbStorageSavedKB = purgedMessages * 2;

        // --- 4. Simple Leaderboard (Active Time) ---
        let leaderboard = [];
        // Add self
        leaderboard.push({
            userId: user._id,
            username: user.username,
            avatar: user.avatar,
            activeTimeMinutes: activeTimeGlobal,
            isMe: true
        });

        // Add contacts
        if (user.contacts && user.contacts.length > 0) {
            for (let c of user.contacts) {
                if (c.userId) {
                    leaderboard.push({
                        userId: c.userId._id,
                        username: c.userId.username,
                        avatar: c.userId.avatar,
                        activeTimeMinutes: c.userId.activeTimeMinutes || 0,
                        isMe: false
                    });
                }
            }
        }
        
        // Sort Leaderboard
        leaderboard.sort((a, b) => b.activeTimeMinutes - a.activeTimeMinutes);

        // Calculate "Zen Rank" Tagline for time
        let rankTagline = "Quiet Observer";
        if (activeTimeGlobal > 1200) { // 20 hours
            rankTagline = "You basically live here, don't you?";
        } else if (activeTimeGlobal > 300) { // 5 hours
            rankTagline = "Social Butterfly";
        } else if (activeTimeGlobal > 60) {
            rankTagline = "Meaningful Connector";
        }

        // Moments Tagline
        let momentsTagline = "Digital Ghost";
        if (momentsShared > 50) {
            rankTagline = "The Main Character";
        } else if (momentsViewed > momentsShared * 5) {
            momentsTagline = "The Ultimate Lurker";
        } else if (momentsShared > 0) {
            momentsTagline = "Casual Sharer";
        }

        // Data Saved Tagline
        let dataTagline = "A light digital footprint.";
        if (estimatedGBSaved > 10) {
            dataTagline = "You're single-handedly cooling down a server farm.";
        } else if (estimatedGBSaved > 1) {
            dataTagline = "That's a lot of gigabytes saved from doom-scrolling.";
        }

        res.json({
            success: true,
            activeTime: {
                global: activeTimeGlobal,
                perContact: activeTimePerContact,
                tagline: rankTagline
            },
            moments: {
                shared: momentsShared,
                viewed: momentsViewed,
                liked: momentsLiked,
                likesReceived: likesReceived,
                tagline: momentsTagline
            },
            dataSaved: {
                gbSaved: estimatedGBSaved.toFixed(2),
                purgedMessages: purgedMessages,
                dbStorageSavedKB: dbStorageSavedKB,
                tagline: dataTagline,
                source: "Based on avg. 150MB/hr Instagram usage vs ZenChat's ~2MB/hr text usage."
            },
            leaderboard
        });

    } catch (err) {
        console.error("[Analytics] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
