require("dotenv").config({ path: "./server/.env" });
const mongoose = require("mongoose");
const User = require("../models/User");

const cleanup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB for cleanup");

        // Remove the old fcmToken field from all users
        const result = await User.updateMany(
            {},
            { $unset: { fcmToken: "" } }
        );

        console.log(`Cleanup complete! Unset fcmToken for ${result.modifiedCount} users.`);
        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
};

cleanup();
