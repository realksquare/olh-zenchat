const express = require("express");
const router = express.Router();
const Moment = require("../models/Moment");
const User = require("../models/User");
const protect = require("../middleware/auth");
const { sendPushNotification } = require("../utils/firebase");
const { onlineUsers } = require("../socket/handlers");

router.post("/", protect, async (req, res) => {
    try {
        const { type, content, mediaUrl, music, caption, locationTag, filter, disappearAfterHours, taggedUsers, lqip, isCaptured, isEncrypted, encryptedPayload, encryptedKeys, iv } = req.body;
        const hours = disappearAfterHours ? Number(disappearAfterHours) : 24;
        const expiresAt = (isCaptured === true || isCaptured === "true") ? null : new Date(Date.now() + hours * 60 * 60 * 1000);

        const moment = await Moment.create({
            userId: req.user._id,
            type,
            content,
            mediaUrl,
            lqip: lqip || "",
            music,
            caption: caption || "",
            locationTag: locationTag || "",
            filter: filter || "none",
            disappearAfterHours: hours,
            expiresAt,
            isCaptured: isCaptured === true || isCaptured === "true",
            taggedUsers: Array.isArray(taggedUsers) ? taggedUsers : [],
            isEncrypted: isEncrypted === true || isEncrypted === "true",
            encryptedPayload: encryptedPayload || "",
            encryptedKeys: encryptedKeys || {},
            iv: iv || ""
        });

        const populated = await Moment.findById(moment._id)
            .populate("userId", "username avatar fullName")
            .populate("taggedUsers", "username avatar fullName");

        console.log(`[moments] New moment shared by ${req.user.username} (${req.user._id}). Type: ${type}`);

        const io = req.app.get("io");
        const user = await User.findById(req.user._id).select("contacts username fullName avatar blockedUsers");
        
        const usersWhoBlockedMe = await User.find({ "blockedUsers.userId": req.user._id }).select("_id");
        const blockedMeIds = usersWhoBlockedMe.map(u => u._id.toString());
        const myBlockedIds = user.blockedUsers?.map(u => u.userId.toString()) || [];
        const excludeUserIds = [...blockedMeIds, ...myBlockedIds];

        const contactIds = user.contacts
            .map(c => c.userId.toString())
            .filter(cid => !excludeUserIds.includes(cid));

        // Collect all socket recipients
        const recipientIds = new Set();
        contactIds.forEach(cid => recipientIds.add(cid.toString()));

        // Process tagged users
        const validTaggedUsers = Array.isArray(taggedUsers) ? taggedUsers : [];
        for (const taggedId of validTaggedUsers) {
            recipientIds.add(taggedId.toString());
            try {
                const taggedUser = await User.findById(taggedId).select("contacts blockedUsers");
                if (taggedUser) {
                    const usersWhoBlockedTagged = await User.find({ "blockedUsers.userId": taggedId }).select("_id");
                    const blockedTaggedMeIds = usersWhoBlockedTagged.map(u => u._id.toString());
                    const taggedBlockedIds = taggedUser.blockedUsers?.map(u => u.userId.toString()) || [];
                    const excludeTaggedIds = [...blockedTaggedMeIds, ...taggedBlockedIds];
                    
                    const taggedContactIds = taggedUser.contacts
                        .map(c => c.userId.toString())
                        .filter(cid => !excludeTaggedIds.includes(cid));
                    
                    taggedContactIds.forEach(cid => recipientIds.add(cid.toString()));
                }
            } catch (err) {
                console.error(`[moments] Error fetching contacts for tagged user ${taggedId}:`, err);
            }
        }

        // Emit to the user themselves
        io.to(req.user._id.toString()).emit("new_moment", populated);

        // Emit to each online recipient and send push notification
        const notificationTitle = `${user.username} has shared a #moment.!`;
        const notificationBody = ""; // Simplified as requested

        recipientIds.forEach(async (cid) => {
            io.to(cid).emit("new_moment", populated);

            // Send Push Notif to direct contacts / tagged users if they are offline
            const isDirectRecipient = contactIds.includes(cid) || validTaggedUsers.includes(cid);
            if (isDirectRecipient && !onlineUsers.has(cid.toString())) {
                try {
                    console.log(`[moments] Sending push to ${cid}. Title: "${notificationTitle}", Body: "${notificationBody}"`);
                    const contact = await User.findById(cid).select("fcmTokens");
                    if (contact && contact.fcmTokens?.length > 0) {
                        const pwaTokens = contact.fcmTokens.filter(t => t.deviceType === 'pwa');
                        const browserTokens = contact.fcmTokens.filter(t => t.deviceType === 'browser');
                        let targetTokens = [];
                        if (pwaTokens.length > 0) {
                            targetTokens = pwaTokens.map(t => t.token);
                        } else if (browserTokens.length > 0) {
                            targetTokens = browserTokens.map(t => t.token);
                        } else {
                            targetTokens = contact.fcmTokens.map(t => t.token);
                        }

                        targetTokens.forEach(token => {
                            sendPushNotification(cid, token, notificationTitle, notificationBody, {
                                icon: user.avatar || "/logo192.png",
                                click_action: "https://olh-zenchat.vercel.app/?tab=moments",
                                tag: `moment-upload-${user._id.toString()}`
                            });
                        });
                    }
                } catch (err) {
                    console.error(`[moments] Notif error for contact ${cid}:`, err);
                }
            }
        });

        res.status(201).json(populated);
    } catch (err) {
        console.error(`[moments] Error sharing moment:`, err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const usersWhoBlockedMe = await User.find({ "blockedUsers.userId": req.user._id }).select("_id");
        const blockedMeIds = usersWhoBlockedMe.map(u => u._id.toString());
        const myBlockedIds = user.blockedUsers?.map(u => u.userId.toString()) || [];
        const excludeUserIds = [...blockedMeIds, ...myBlockedIds];

        const contactIds = user.contacts
            .map(c => c.userId.toString())
            .filter(cid => !excludeUserIds.includes(cid));

        console.log(`[moments] ${user.username} fetching. Contacts found: ${contactIds.length}`);

        const moments = await Moment.find({
            $or: [
                { userId: req.user._id },
                { userId: { $in: contactIds } },
                { taggedUsers: req.user._id },
                { taggedUsers: { $in: contactIds } }
            ],
            $or: [
                { expiresAt: { $gt: new Date() } },
                { isCaptured: true, createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            ]
        })
        .populate("userId", "username avatar fullName")
        .populate("taggedUsers", "username avatar fullName")
        .sort({ createdAt: -1 });

        const filteredMoments = moments.map(m => {
            const momentObj = m.toObject();
            const isOwner = (momentObj.userId?._id || momentObj.userId)?.toString() === req.user._id.toString();
            if (!isOwner) {
                const hasLiked = momentObj.likes?.some(id => id.toString() === req.user._id.toString());
                momentObj.likes = hasLiked ? [req.user._id] : [];
            } else {
                momentObj.likes = momentObj.likes?.map(id => id.toString()) || [];
            }
            return momentObj;
        });

        console.log(`[moments] Returning ${filteredMoments.length} moments for ${user.username}`);
        res.json(filteredMoments);
    } catch (err) {
        console.error(`[moments] Fetch error:`, err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/captured", protect, async (req, res) => {
    try {
        const moments = await Moment.find({
            userId: req.user._id,
            isCaptured: true
        })
        .populate("userId", "username avatar fullName")
        .populate("taggedUsers", "username avatar fullName")
        .sort({ createdAt: -1 });

        res.json(moments);
    } catch (err) {
        console.error("[moments] Captured fetch error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:id/view", protect, async (req, res) => {
    try {
        const moment = await Moment.findById(req.params.id);
        if (!moment) return res.json({ success: true });
        
        // Only add if not the uploader and not already viewed by this user
        const uploaderId = moment.userId.toString();
        const viewerId = req.user._id.toString();
        const alreadyViewed = moment.viewedBy.some(v => v.userId?.toString() === viewerId);
        
        if (uploaderId !== viewerId && !alreadyViewed) {
            await Moment.findByIdAndUpdate(
                req.params.id,
                { $push: { viewedBy: { userId: req.user._id, at: new Date() } } },
                { new: true }
            );
        }
        
        // Return updated moment so client can sync viewedBy immediately
        const updated = await Moment.findById(req.params.id)
            .populate("userId", "username avatar fullName")
            .populate("taggedUsers", "username avatar fullName");
        const momentObj = updated.toObject();
        const isOwner = (momentObj.userId?._id || momentObj.userId)?.toString() === req.user._id.toString();
        if (!isOwner) {
            const hasLiked = momentObj.likes?.some(id => id.toString() === req.user._id.toString());
            momentObj.likes = hasLiked ? [req.user._id] : [];
        } else {
            momentObj.likes = momentObj.likes?.map(id => id.toString()) || [];
        }
        res.json({ success: true, moment: momentObj });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/:id", protect, async (req, res) => {
    try {
        const moment = await Moment.findById(req.params.id);
        if (!moment) return res.status(404).json({ message: "Moment not found" });

        if (moment.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Not authorized" });
        }

        await moment.deleteOne();
        console.log(`[moments] Moment ${req.params.id} let go by ${req.user.username}`);

        // Notify the uploader + all contacts in real-time
        const io = req.app.get("io");
        if (io) {
            const user = await User.findById(req.user._id).select("contacts");
            const contactIds = (user?.contacts || []).map(c => c.userId.toString());

            // Notify the owner's own sockets (multi-device)
            io.to(req.user._id.toString()).emit("moment_deleted", { momentId: req.params.id });

            // Notify all contacts
            contactIds.forEach(cid => {
                io.to(cid).emit("moment_deleted", { momentId: req.params.id });
            });
        }

        res.json({ message: "Moment let go." });
    } catch (err) {
        console.error("[moments] Let-go error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:id/like", protect, async (req, res) => {
    try {
        const moment = await Moment.findById(req.params.id);
        if (!moment) return res.status(404).json({ message: "Moment not found" });

        const userId = req.user._id.toString();
        const ownerId = moment.userId.toString();

        // Owner cannot like their own moment
        if (userId === ownerId) {
            return res.status(403).json({ message: "You cannot like your own moment" });
        }

        const alreadyLiked = moment.likes.some(id => id.toString() === userId);
        const update = alreadyLiked
            ? { $pull: { likes: req.user._id } }
            : { $addToSet: { likes: req.user._id } };

        const updated = await Moment.findByIdAndUpdate(req.params.id, update, { new: true })
            .populate("userId", "username avatar fullName")
            .populate("taggedUsers", "username avatar fullName");

        // Broadcast to owner + all their contacts so like count updates in real-time
        const io = req.app.get("io");
        if (io) {
            const owner = await User.findById(ownerId).select("contacts");
            const contactIds = (owner?.contacts || []).map(c => c.userId.toString());
            
            // Emit the full list of likes only to the owner
            io.to(ownerId).emit("moment_liked", {
                momentId: req.params.id,
                likes: updated.likes.map(id => id.toString())
            });
            
            // Emit filtered likes list to each contact separately
            contactIds.forEach(cid => {
                const hasLiked = updated.likes.some(id => id.toString() === cid.toString());
                io.to(cid).emit("moment_liked", {
                    momentId: req.params.id,
                    likes: hasLiked ? [cid] : []
                });
            });
        }

        // Send Push Notif to the moment owner if they are offline and a new like was added
        if (!alreadyLiked && !onlineUsers.has(ownerId)) {
            try {
                const liker = await User.findById(req.user._id).select("username avatar");
                const ownerUser = await User.findById(ownerId).select("fcmTokens");
                if (ownerUser && ownerUser.fcmTokens?.length > 0) {
                    const notificationTitle = `${liker.username} liked your #moment.!`;
                    const notificationBody = ""; 
                    
                    const pwaTokens = ownerUser.fcmTokens.filter(t => t.deviceType === 'pwa');
                    const browserTokens = ownerUser.fcmTokens.filter(t => t.deviceType === 'browser');
                    let targetTokens = [];
                    if (pwaTokens.length > 0) {
                        targetTokens = pwaTokens.map(t => t.token);
                    } else if (browserTokens.length > 0) {
                        targetTokens = browserTokens.map(t => t.token);
                    } else {
                        targetTokens = ownerUser.fcmTokens.map(t => t.token);
                    }

                    targetTokens.forEach(token => {
                        sendPushNotification(ownerId, token, notificationTitle, notificationBody, {
                            icon: liker.avatar || "/logo192.png",
                            click_action: "https://olh-zenchat.vercel.app/?tab=moments",
                            tag: `moment-like-${req.params.id}`
                        });
                    });
                }
            } catch (err) {
                console.error(`[moments] Like push error for owner ${ownerId}:`, err);
            }
        }

        const userHasLiked = updated.likes.some(id => id.toString() === userId);
        res.json({ success: true, likes: userHasLiked ? [userId] : [], liked: !alreadyLiked });
    } catch (err) {
        console.error("[moments] Like error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/:id/reshare", protect, async (req, res) => {
    try {
        const moment = await Moment.findById(req.params.id)
            .populate("userId", "username avatar fullName");
        if (!moment) return res.status(404).json({ message: "Moment not found" });

        // Only tagged users can reshare
        const isTagged = Array.isArray(moment.taggedUsers) && moment.taggedUsers.some(u =>
            u && (u._id || u).toString() === req.user._id.toString()
        );
        if (!isTagged) {
            return res.status(403).json({ message: "Only tagged users can reshare this moment" });
        }

        // Prevent duplicate reshares
        const alreadyReshared = await Moment.findOne({
            userId: req.user._id,
            resharedFrom: moment._id
        });
        if (alreadyReshared) {
            return res.status(409).json({ message: "You have already reshared this moment" });
        }

        const original = moment.toObject();
        const hours = original.disappearAfterHours || 24;
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

        const reshared = await Moment.create({
            userId: req.user._id,
            type: original.type,
            content: original.content,
            mediaUrl: original.mediaUrl,
            lqip: original.lqip || "",
            music: original.music || undefined,
            caption: original.caption,
            locationTag: original.locationTag,
            filter: original.filter,
            disappearAfterHours: hours,
            expiresAt,
            resharedFrom: moment._id,
            taggedUsers: []
        });

        const populated = await Moment.findById(reshared._id)
            .populate("userId", "username avatar fullName")
            .populate("taggedUsers", "username avatar fullName");

        console.log(`[moments] ${req.user.username} reshared moment ${moment._id}`);

        const io = req.app.get("io");
        const resharer = await User.findById(req.user._id).select("contacts username avatar blockedUsers");
        if (!resharer) {
            return res.status(404).json({ message: "User not found" });
        }

        const usersWhoBlockedMe = await User.find({ "blockedUsers.userId": req.user._id }).select("_id");
        const blockedMeIds = usersWhoBlockedMe.map(u => u._id.toString());
        const myBlockedIds = (resharer.blockedUsers || [])
            .filter(u => u && u.userId)
            .map(u => u.userId.toString());
        const excludeUserIds = [...blockedMeIds, ...myBlockedIds];

        const contactIds = (resharer.contacts || [])
            .filter(c => c && c.userId)
            .map(c => c.userId.toString())
            .filter(cid => !excludeUserIds.includes(cid));

        // Emit to resharer themselves and their contacts
        if (io) {
            io.to(req.user._id.toString()).emit("new_moment", populated);
            contactIds.forEach(cid => io.to(cid).emit("new_moment", populated));
        }

        // Push notification to the original moment author
        const authorId = moment.userId 
            ? (moment.userId._id || moment.userId).toString() 
            : null;

        const handlers = require("../socket/handlers");
        const activeUsersMap = handlers?.onlineUsers || onlineUsers;
        const isAuthorOnline = authorId && activeUsersMap && typeof activeUsersMap.has === 'function'
            ? activeUsersMap.has(authorId)
            : false;

        if (authorId && authorId !== req.user._id.toString() && !isAuthorOnline) {
            try {
                const authorUser = await User.findById(authorId).select("fcmTokens");
                if (authorUser && Array.isArray(authorUser.fcmTokens) && authorUser.fcmTokens.length > 0) {
                    const notificationTitle = `${resharer.username} has shared a #moment.!`;
                    const pwaTokens = authorUser.fcmTokens.filter(t => t && t.deviceType === 'pwa');
                    const browserTokens = authorUser.fcmTokens.filter(t => t && t.deviceType === 'browser');
                    let targetTokens = pwaTokens.length > 0
                        ? pwaTokens.map(t => t.token)
                        : browserTokens.length > 0
                            ? browserTokens.map(t => t.token)
                            : authorUser.fcmTokens.map(t => t.token);

                    targetTokens.forEach(token => {
                        if (token) {
                            sendPushNotification(authorId, token, notificationTitle, "", {
                                icon: resharer.avatar || "/logo192.png",
                                click_action: "https://olh-zenchat.vercel.app/?tab=moments",
                                tag: `moment-reshare-${reshared._id.toString()}`
                            });
                        }
                    });
                }
            } catch (err) {
                console.error(`[moments] Reshare push notif error for author ${authorId}:`, err);
            }
        }

        res.status(201).json({ success: true, moment: populated });
    } catch (err) {
        console.error("[moments] Reshare error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;

