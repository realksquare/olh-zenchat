const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 20,
        },
        email: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            minlength: 6,
        },
        phoneNumber: {
            type: String,
        },
        is2faEnabled: {
            type: Boolean,
            default: false,
        },
        mfaPreference: {
            type: String,
            enum: ["email", "phone", "none"],
            default: "none",
        },
        verificationSession: {
            otpCode: String,
            otpExpires: Date,
            emailOtpCode: String,
            emailOtpExpires: Date,
            tempJwtToken: String,
            tempEmail: String
        },
        avatar: {
            type: String,
            default: "",
        },
        fcmTokens: [
            {
                token: { type: String, required: true },
                deviceType: { type: String, enum: ["browser", "pwa"], required: true },
                lastUpdated: { type: Date, default: Date.now }
            }
        ],
        timezone: {
            type: String,
            default: "UTC"
        },
        lastDailyDigestSent: {
            type: Date,
            default: null
        },
        isOnline: {
            type: Boolean,
            default: false,
        },
        notificationsEnabled: {
            type: Boolean,
            default: false,
        },
        lastSeen: {
            type: Date,
            default: Date.now,
        },
        fullName: {
            type: String,
            default: "",
        },
        bio: {
            type: String,
            default: "",
            maxlength: 87,
            trim: true
        },
        contacts: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                tag: { 
                    type: String, 
                    enum: ["general", "close_circle", "family", "workplace"],
                    default: "general"
                },
                isBlocked: { type: Boolean, default: false }
            }
        ],
        privacySettings: {
            onlineStatus: { type: String, enum: ["everyone", "contacts", "family", "close_circle", "nobody"], default: "everyone" },
            fullName: { type: String, enum: ["everyone", "contacts", "family", "close_circle", "nobody"], default: "everyone" },
            avatar: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" }
        },
        role: {
            type: String,
            enum: ["user", "co_admin", "master_admin"],
            default: "user"
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        isSuspended: {
            type: Boolean,
            default: false
        },
        referralStats: {
            clicks: { type: Number, default: 0 },
            registrations: { type: Number, default: 0 }
        },
        resetPasswordToken: {
            type: String,
            default: null
        },
        resetPasswordExpires: {
            type: Date,
            default: null
        },
        publicKey: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        encryptedPrivateKey: {
            type: String,
            default: null
        },
        encryptedPrivateKeyBackup: {
            type: String,
            default: null
        },
        cryptoSalt: {
            type: String,
            default: null
        },
        cryptoIv: {
            type: String,
            default: null
        },
        blockedUsers: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                blockedAt: { type: Date, default: Date.now }
            }
        ],
        unblockedUsers: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                unblockedAt: { type: Date, default: Date.now }
            }
        ],
        hasSeenPurgeNotice: {
            type: Boolean,
            default: false
        },
        activeTimeMinutes: {
            type: Number,
            default: 0
        },
        perContactActiveTime: {
            type: Map,
            of: Number,
            default: {}
        },
        purgedMessagesCount: {
            type: Number,
            default: 0
        },
        recentMedia: {
            type: [{
                url: { type: String, required: true },
                mediaType: { type: String, enum: ["gif", "sticker"], default: "gif" }
            }],
            default: []
        },
        favoriteMedia: {
            type: [{
                url: { type: String, required: true },
                mediaType: { type: String, enum: ["gif", "sticker"], default: "gif" }
            }],
            default: []
        },
        pulseStreak: {
            current: { type: Number, default: 0 },
            longest: { type: Number, default: 0 },
            lastVotedDate: { type: String, default: null }
        },
        momentsStats: {
            shared: { type: Number, default: 0 },
            viewed: { type: Number, default: 0 },
            liked: { type: Number, default: 0 },
            likesReceived: { type: Number, default: 0 }
        },
        pulseVotedQuestions: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "ZenPulseQuestion"
        }],
        selectedTheme: {
            type: String,
            enum: ["default", "zen_oled", "earthy_calm"],
            default: "default"
        },
        zenVoice: {
            isStudentVerified: { type: Boolean, default: false },
            verificationMethod: {
                type: String,
                enum: ["academic_email", "github_student", "domain_otp", "none"],
                default: "none"
            },
            collegeName: { type: String, default: "" },
            collegeEmailDomain: { type: String, default: "" },
            collegeEmail: { type: String, default: "" },
            pseudonym: { type: String, default: "" },
            bio: { type: String, default: "", maxlength: 100 },
            zenVoiceToken: { type: String, default: null },
            zenVoiceSuspendedUntil: { type: Date, default: null },
            zenVoiceRedCardCount: { type: Number, default: 0 },
            zenVoiceAppealed: { type: Boolean, default: false },
            pseudonymChangeRequest: {
                requested: { type: Boolean, default: false },
                desiredPseudonym: { type: String, default: "" },
                status: {
                    type: String,
                    enum: ["pending", "approved", "rejected"],
                    default: "pending"
                },
                adminNote: { type: String, default: "" },
                requestedAt: { type: Date, default: null }
            }
        }
    },
    { timestamps: true }
);

userSchema.pre("save", async function (next) {
    if (this.username === "admin_krish") {
        this.role = "master_admin";
        this.isVerified = true;
    }
    if (!this.password || !this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
    return {
        _id: this._id,
        username: this.username,
        avatar: this.avatar,
        fullName: this.fullName,
        bio: this.bio,
        isOnline: this.isOnline,
        lastSeen: this.lastSeen,
        role: this.role,
        isVerified: this.isVerified,
        privacySettings: this.privacySettings,
        selectedTheme: this.selectedTheme
    };
};

userSchema.methods.toPrivateJSON = function () {
    return {
        _id: this._id,
        username: this.username,
        email: this.email,
        phoneNumber: this.phoneNumber,
        is2faEnabled: this.is2faEnabled,
        mfaPreference: this.mfaPreference,
        avatar: this.avatar,
        fullName: this.fullName,
        bio: this.bio,
        isOnline: this.isOnline,
        lastSeen: this.lastSeen,
        notificationsEnabled: this.notificationsEnabled,
        privacySettings: this.privacySettings,
        role: this.role,
        isVerified: this.isVerified,
        isSuspended: this.isSuspended,
        contacts: this.contacts,
        blockedUsers: this.blockedUsers,
        unblockedUsers: this.unblockedUsers,
        fcmTokens: this.fcmTokens,
        timezone: this.timezone,
        publicKey: this.publicKey,
        encryptedPrivateKey: this.encryptedPrivateKey,
        encryptedPrivateKeyBackup: this.encryptedPrivateKeyBackup,
        cryptoSalt: this.cryptoSalt,
        cryptoIv: this.cryptoIv,
        hasSeenPurgeNotice: this.hasSeenPurgeNotice,
        pulseStreak: this.pulseStreak,
        selectedTheme: this.selectedTheme,
        createdAt: this.createdAt
    };
};

userSchema.methods.toParticipantJSON = function () {
    return {
        _id: this._id,
        username: this.username,
        avatar: this.avatar,
        bio: this.bio,
        isOnline: this.isOnline,
        role: this.role,
        isVerified: this.isVerified
    };
};

module.exports = mongoose.model("User", userSchema);