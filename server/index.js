require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const compression = require("compression");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const connectDB = require("./utils/db");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const messageRoutes = require("./routes/message");
const registerSocketHandlers = require("./socket/handlers");
const User = require("./models/User");

const app = express();
app.set("trust proxy", 1);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { message: "Too many authentication attempts, please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,
    message: { message: "Too many requests, please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
});

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

app.get("/", (req, res) => {
    console.log(`[Pulse] Heartbeat received at ${new Date().toISOString()}`);
    res.json({ status: "alive", message: "ZenChat Server is humming!", timestamp: new Date() });
});

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", version: "59e125d", uptime: process.uptime() });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/chats", apiLimiter, chatRoutes);
app.use("/api/messages", apiLimiter, messageRoutes);
app.use("/api/moments", apiLimiter, require("./routes/momentRoutes"));
app.use("/api/admin", apiLimiter, require("./routes/admin"));
app.use("/api/music", apiLimiter, require("./routes/music"));
app.use("/api/giphy", apiLimiter, require("./routes/giphy"));
app.use("/api/analytics", apiLimiter, require("./routes/analytics"));
app.use("/api/messages/bulk", apiLimiter, require("./routes/bulkMessage"));
app.use("/api/user-media", apiLimiter, require("./routes/userMedia"));

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
    await User.updateMany({}, { $set: { isOnline: false } });
    await User.updateMany({ mfaPreference: "phone" }, { $set: { mfaPreference: "email" } });

    const { startCronJobs } = require("./utils/cronJobs");
    startCronJobs();

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});