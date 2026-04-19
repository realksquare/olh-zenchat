require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const compression = require("compression");
const { Server } = require("socket.io");
const connectDB = require("./utils/db");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const messageRoutes = require("./routes/message");
const registerSocketHandlers = require("./socket/handlers");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST"],
    },
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(compression());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
    await User.updateMany({}, { $set: { isOnline: false, lastSeen: new Date() } });
    console.log("🧹 Ghost users swept offline");

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});