require("dotenv").config({ path: "./server/.env" });
const mongoose = require("mongoose");
const User = require("../models/User");

const promote = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const result = await User.findOneAndUpdate(
            { username: "admin_krish" },
            { 
                $set: { 
                    role: "master_admin",
                    isVerified: true 
                } 
            },
            { new: true }
        );

        if (result) {
            console.log("admin_krish promoted to master_admin and verified!");
            console.log(result.toPublicJSON());
        } else {
            console.log("User admin_krish not found");
        }

        process.exit(0);
    } catch (err) {
        console.error("Promotion failed:", err);
        process.exit(1);
    }
};

promote();
