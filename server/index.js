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

const allowedOrigins = [
    process.env.CLIENT_URL,
    "https://olh-zenchat.vercel.app",
    "https://olh-zenchat.onrender.com",
    "http://localhost:5173"
].filter(Boolean).map(url => url.replace(/\/$/, ""));

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        credentials: true
    },
});

app.set("io", io);

app.use(cors({ 
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));

app.use(compression());
app.use(express.json());

app.options("*", cors());

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admin", require("./routes/admin"));

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
    await User.updateMany({}, { $set: { isOnline: false } });


    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});