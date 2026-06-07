require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const User = require("../models/User");

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");
        
        const users = await User.find({});
        let updatedCount = 0;
        
        for (const user of users) {
            const oldUsername = user.username;
            if (!/^[a-z0-9_]+$/.test(oldUsername)) {
                let newUsername = oldUsername.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                
                // Ensure it meets min length
                if (newUsername.length < 3) {
                    newUsername = newUsername.padEnd(3, "_");
                }
                
                let isUnique = false;
                let attempt = 0;
                let finalUsername = newUsername;
                
                while (!isUnique) {
                    const exists = await User.findOne({ username: finalUsername, _id: { $ne: user._id } });
                    if (!exists) {
                        isUnique = true;
                    } else {
                        attempt++;
                        finalUsername = `${newUsername}_${Math.floor(100 + Math.random() * 900)}`;
                    }
                }
                
                user.username = finalUsername;
                await user.save();
                console.log(`Migrated: "${oldUsername}" -> "${finalUsername}"`);
                updatedCount++;
            }
        }
        
        console.log(`Migration complete. Updated ${updatedCount} users.`);
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
};

migrate();
