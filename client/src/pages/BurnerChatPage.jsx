import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { encryptBurnerMessage, decryptBurnerMessage } from "../utils/burnerCrypto";
import { useAuthStore } from "../stores/authStore";

const DEFAULT_BACKEND_URL = "https://olh-zenchat.onrender.com";

const getBaseBackendURL = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.replace(/\/$/, "");
    }
    if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        return DEFAULT_BACKEND_URL;
    }
    return window.location.origin;
};

const BurnerChatPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const loggedInUser = useAuthStore((s) => s.user);
    const loggedInToken = useAuthStore((s) => s.token);

    const [secretKey, setSecretKey] = useState("");
    const [keyMissing, setKeyMissing] = useState(false);
    const [bridgeInfo, setBridgeInfo] = useState(null);
    const [status, setStatus] = useState("loading"); // loading, active, burned, expired, not_found
    const [isJoined, setIsJoined] = useState(false);
    const [guestAlias, setGuestAlias] = useState("");
    const [myAlias, setMyAlias] = useState("");
    const [isHost, setIsHost] = useState(false);
    const [sessionToken, setSessionToken] = useState("");

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [peerTyping, setPeerTyping] = useState("");
    const [peerConnected, setPeerConnected] = useState(false);
    const [timeLeftStr, setTimeLeftStr] = useState("");
    const [showBurnConfirm, setShowBurnConfirm] = useState(false);
    const [burnedData, setBurnedData] = useState(null);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // 1. Extract secret key from URL hash fragment (#<key>) or sessionStorage
    useEffect(() => {
        let hashKey = window.location.hash?.replace(/^#/, "").trim();
        if (!hashKey) {
            // Check if creator stored it in sessionStorage
            const cached = sessionStorage.getItem(`burner_key_${token}`);
            if (cached) hashKey = cached;
        }

        if (hashKey && hashKey.length >= 32) {
            setSecretKey(hashKey);
            sessionStorage.setItem(`burner_key_${token}`, hashKey);
        } else {
            setKeyMissing(true);
        }
    }, [token]);

    // 2. Fetch bridge preview & validate status
    useEffect(() => {
        const fetchPreview = async () => {
            try {
                const apiBase = getBaseBackendURL();
                const res = await axios.get(`${apiBase}/api/burner/${token}/preview`);
                const data = res.data;

                if (!data.valid) {
                    setStatus(data.status || "burned");
                    setBurnedData({
                        burnReason: data.burnReason,
                        message: data.message || "This bridge is no longer available.",
                    });
                    return;
                }

                setBridgeInfo(data);
                setStatus("active");

                // If user is already logged in as the creator, auto-join as host
                if (loggedInToken && loggedInUser) {
                    setIsHost(true);
                    setMyAlias(data.creatorAlias || loggedInUser.username);
                    setSessionToken(loggedInToken);
                    setIsJoined(true);
                }
            } catch (err) {
                console.error("[Burner] Preview fetch failed:", err);
                if (err.response?.status === 404) {
                    setStatus("not_found");
                } else {
                    setStatus("burned");
                    setBurnedData({
                        message: "This bridge has burned into ash. Zero records exist.",
                    });
                }
            }
        };

        if (token) {
            fetchPreview();
        }
    }, [token, loggedInToken, loggedInUser]);

    // 3. Countdown timer
    useEffect(() => {
        if (!bridgeInfo?.expiresAt || status !== "active") return;

        const updateTimer = () => {
            const diff = new Date(bridgeInfo.expiresAt) - new Date();
            if (diff <= 0) {
                setTimeLeftStr("00:00:00");
                setStatus("expired");
                setBurnedData({
                    burnReason: "time_expired",
                    message: "Time limit expired. Bridge destroyed.",
                });
                return;
            }

            const hrs = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
            const mins = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, "0");
            const secs = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, "0");
            setTimeLeftStr(`${hrs}:${mins}:${secs}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [bridgeInfo?.expiresAt, status]);

    // 4. Guest Join action
    const handleJoinBridge = async (e) => {
        if (e) e.preventDefault();
        try {
            const apiBase = getBaseBackendURL();
            const res = await axios.post(`${apiBase}/api/burner/${token}/join`, {
                guestAlias: guestAlias.trim() || undefined,
            });

            if (res.data?.success) {
                setSessionToken(res.data.guestSessionToken);
                setMyAlias(res.data.guestAlias);
                setIsJoined(true);
                setIsHost(false);
            }
        } catch (err) {
            console.error("[Burner] Failed to join bridge:", err);
            alert("Could not join burner bridge. It may have expired.");
        }
    };

    // 5. Connect Socket when joined
    useEffect(() => {
        if (!isJoined || !sessionToken || !token) return;

        const backendUrl = getBaseBackendURL();
        const socket = io(`${backendUrl}/burner`, {
            auth: {
                token: isHost ? sessionToken : undefined,
                guestToken: !isHost ? sessionToken : undefined,
                bridgeToken: token,
            },
            transports: ["websocket", "polling"],
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("join_bridge", { bridgeToken: token });
        });

        socket.on("burner_peer_joined", (data) => {
            setPeerConnected(true);
            setMessages((prev) => [
                ...prev,
                {
                    _id: `sys-${Date.now()}`,
                    senderType: "system",
                    text: `${data.senderAlias} joined the bridge.`,
                    createdAt: new Date(),
                },
            ]);
        });

        socket.on("burner_message_received", async (msg) => {
            let plaintext = msg.content;
            if (msg.iv && secretKey) {
                plaintext = await decryptBurnerMessage(msg.content, msg.iv, secretKey);
            }

            setMessages((prev) => {
                if (prev.some((m) => m._id === msg._id)) return prev;
                return [
                    ...prev,
                    {
                        _id: msg._id,
                        senderType: msg.senderType,
                        senderAlias: msg.senderAlias,
                        senderId: msg.senderId,
                        text: plaintext,
                        createdAt: msg.createdAt,
                    },
                ];
            });
        });

        socket.on("burner_peer_typing", ({ senderAlias, isTyping }) => {
            if (isTyping) {
                setPeerTyping(`${senderAlias} is typing...`);
            } else {
                setPeerTyping("");
            }
        });

        socket.on("burner_destroyed", (data) => {
            setStatus("burned");
            setBurnedData(data);
            setMessages([]);
            sessionStorage.removeItem(`burner_key_${token}`);
            socket.disconnect();
        });

        // Load existing messages
        const loadInitialMessages = async () => {
            try {
                const apiBase = getBaseBackendURL();
                const res = await axios.get(`${apiBase}/api/burner/${token}/messages`, {
                    headers: { Authorization: `Bearer ${sessionToken}` },
                });

                if (res.data?.success && Array.isArray(res.data.messages)) {
                    const decrypted = await Promise.all(
                        res.data.messages.map(async (m) => {
                            let text = m.content;
                            if (m.iv && secretKey) {
                                text = await decryptBurnerMessage(m.content, m.iv, secretKey);
                            }
                            return {
                                _id: m._id,
                                senderType: m.senderType,
                                senderAlias: m.senderAlias,
                                senderId: m.senderId,
                                text,
                                createdAt: m.createdAt,
                            };
                        })
                    );
                    setMessages(decrypted);
                }
            } catch (err) {
                console.error("[Burner] Error loading messages:", err);
            }
        };

        loadInitialMessages();

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isJoined, sessionToken, token, secretKey, isHost]);

    // Auto-scroll on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, peerTyping]);

    // Send Message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || !secretKey || !socketRef.current) return;

        try {
            const { ciphertext, iv } = await encryptBurnerMessage(text, secretKey);
            socketRef.current.emit("burner_send_message", {
                bridgeToken: token,
                content: ciphertext,
                iv,
                type: "text",
            });
            setInputText("");

            // Stop typing status
            socketRef.current.emit("burner_typing", {
                bridgeToken: token,
                isTyping: false,
            });
        } catch (err) {
            console.error("[Burner] Failed to send message:", err);
        }
    };

    const handleInputChange = (e) => {
        setInputText(e.target.value);
        if (socketRef.current) {
            socketRef.current.emit("burner_typing", {
                bridgeToken: token,
                isTyping: true,
            });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socketRef.current?.emit("burner_typing", {
                    bridgeToken: token,
                    isTyping: false,
                });
            }, 1800);
        }
    };

    // Trigger Burn
    const handleBurnNow = () => {
        if (socketRef.current) {
            socketRef.current.emit("burner_burn_now", { bridgeToken: token });
        }
        setShowBurnConfirm(false);
    };

    // Render loading
    if (status === "loading") {
        return (
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0f1d", color: "#94a3b8" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "36px", height: "36px", border: "3px solid rgba(249,115,22,0.2)", borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <span style={{ fontSize: "0.9rem", fontWeight: "500" }}>Connecting to Burner Bridge...</span>
                </div>
            </div>
        );
    }

    // Render Burned / Expired state (Incinerated)
    if (status === "burned" || status === "expired" || status === "not_found") {
        return (
            <div style={{ minHeight: "100vh", background: "#070b14", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                <div
                    style={{
                        maxWidth: "440px",
                        width: "100%",
                        background: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                        borderRadius: "24px",
                        padding: "36px 28px",
                        textAlign: "center",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                    }}
                >
                    <div
                        style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "20px",
                            background: "rgba(239, 68, 68, 0.12)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 20px",
                            color: "#ef4444",
                        }}
                    >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </svg>
                    </div>

                    <h1 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#f8fafc", marginBottom: "8px" }}>
                        {status === "not_found" ? "Bridge Not Found" : "Bridge Burned"}
                    </h1>

                    <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: "1.6", marginBottom: "24px" }}>
                        {burnedData?.message || "This burner bridge session has self-destructed. All messages were purged from database memory and no records remain."}
                    </p>

                    <button
                        onClick={() => navigate("/")}
                        style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "12px",
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#ffffff",
                            fontWeight: "600",
                            fontSize: "0.92rem",
                            cursor: "pointer",
                        }}
                    >
                        Go to ZenChat
                    </button>
                </div>
            </div>
        );
    }

    // Render Missing Key warning
    if (keyMissing) {
        return (
            <div style={{ minHeight: "100vh", background: "#070b14", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                <div
                    style={{
                        maxWidth: "440px",
                        width: "100%",
                        background: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "24px",
                        padding: "36px 28px",
                        textAlign: "center",
                    }}
                >
                    <div
                        style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "16px",
                            background: "rgba(245, 158, 11, 0.12)",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 16px",
                            color: "#f59e0b",
                        }}
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>

                    <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#f8fafc", marginBottom: "8px" }}>
                        Decryption Key Missing
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: "1.6", marginBottom: "20px" }}>
                        The URL hash fragment containing the zero-knowledge encryption key was missing or stripped. Without the key fragment, this bridge cannot be decrypted.
                    </p>
                    <button
                        onClick={() => navigate("/")}
                        style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "12px",
                            background: "#3b82f6",
                            border: "none",
                            color: "#fff",
                            fontWeight: "600",
                            cursor: "pointer",
                        }}
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    // Render Guest Nickname Onboarding Prompt
    if (!isJoined) {
        return (
            <div style={{ minHeight: "100vh", background: "#070b14", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                <div
                    style={{
                        maxWidth: "420px",
                        width: "100%",
                        background: "rgba(15, 23, 42, 0.8)",
                        border: "1px solid rgba(249, 115, 22, 0.25)",
                        borderRadius: "24px",
                        padding: "36px 28px",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
                    }}
                >
                    <div style={{ textAlign: "center", marginBottom: "24px" }}>
                        <div
                            style={{
                                width: "54px",
                                height: "54px",
                                borderRadius: "16px",
                                background: "rgba(249, 115, 22, 0.15)",
                                border: "1px solid rgba(249, 115, 22, 0.3)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#f97316",
                                marginBottom: "12px",
                            }}
                        >
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                            </svg>
                        </div>
                        <h2 style={{ fontSize: "1.3rem", fontWeight: "700", color: "#f8fafc", margin: "0 0 6px 0" }}>
                            Join Burner Bridge
                        </h2>
                        <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
                            Chat with <strong style={{ color: "#f97316" }}>{bridgeInfo?.creatorAlias}</strong>. No account required.
                        </p>
                    </div>

                    <form onSubmit={handleJoinBridge} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <label style={{ fontSize: "0.8rem", color: "#cbd5e1", fontWeight: "600", marginBottom: "6px", display: "block" }}>
                                Choose a nickname
                            </label>
                            <input
                                type="text"
                                placeholder="Anonymous Guest"
                                value={guestAlias}
                                onChange={(e) => setGuestAlias(e.target.value)}
                                maxLength={20}
                                autoFocus
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: "12px",
                                    background: "rgba(0,0,0,0.3)",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    color: "#f8fafc",
                                    fontSize: "0.95rem",
                                    boxSizing: "border-box",
                                    outline: "none",
                                }}
                            />
                        </div>

                        <div
                            style={{
                                padding: "10px 12px",
                                borderRadius: "10px",
                                background: "rgba(255,255,255,0.03)",
                                fontSize: "0.76rem",
                                color: "#94a3b8",
                                lineHeight: "1.5",
                            }}
                        >
                            Self-destructs in <strong>{timeLeftStr}</strong>. Zero messages or identity metadata are permanently logged.
                        </div>

                        <button
                            type="submit"
                            style={{
                                width: "100%",
                                padding: "13px",
                                borderRadius: "12px",
                                background: "#f97316",
                                border: "none",
                                color: "#ffffff",
                                fontWeight: "600",
                                fontSize: "0.95rem",
                                cursor: "pointer",
                                transition: "transform 0.1s, opacity 0.2s",
                            }}
                        >
                            Enter Ephemeral Chat
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Active Chat Interface
    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#070b14", color: "#f8fafc", overflow: "hidden" }}>
            {/* Top Bar */}
            <header
                style={{
                    padding: "12px 18px",
                    background: "rgba(15, 23, 42, 0.9)",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backdropFilter: "blur(12px)",
                    zIndex: 10,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                        style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "10px",
                            background: "rgba(249, 115, 22, 0.15)",
                            border: "1px solid rgba(249, 115, 22, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#f97316",
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                                Burner Bridge #{token.slice(0, 6)}
                            </span>
                            <span
                                style={{
                                    fontSize: "0.68rem",
                                    padding: "2px 6px",
                                    borderRadius: "6px",
                                    background: "rgba(16, 185, 129, 0.15)",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                    color: "#10b981",
                                    fontWeight: "600",
                                }}
                            >
                                E2EE RAM
                            </span>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            You: <strong style={{ color: "#e2e8f0" }}>{myAlias}</strong> ({isHost ? "Host" : "Guest"})
                        </span>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {/* Countdown Pill */}
                    <div
                        style={{
                            padding: "6px 12px",
                            borderRadius: "20px",
                            background: "rgba(249, 115, 22, 0.12)",
                            border: "1px solid rgba(249, 115, 22, 0.25)",
                            color: "#f97316",
                            fontSize: "0.8rem",
                            fontWeight: "700",
                            fontFamily: "monospace",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f97316" }} />
                        {timeLeftStr || "24:00:00"}
                    </div>

                    {/* Incinerate / Burn Button */}
                    <button
                        onClick={() => setShowBurnConfirm(true)}
                        style={{
                            padding: "7px 12px",
                            borderRadius: "10px",
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.35)",
                            color: "#f87171",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Burn Now
                    </button>
                </div>
            </header>

            {/* Message Stream */}
            <main
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "20px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxWidth: "768px",
                    width: "100%",
                    margin: "0 auto",
                    boxSizing: "border-box",
                }}
            >
                {/* Intro Security Notice Banner */}
                <div
                    style={{
                        margin: "0 auto 12px",
                        padding: "10px 16px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        fontSize: "0.78rem",
                        color: "#64748b",
                        textAlign: "center",
                        maxWidth: "480px",
                        lineHeight: "1.5",
                    }}
                >
                    Messages in this burner bridge are encrypted client-side using AES-256-GCM. No chat history will be archived after the timer expires or either party hits Burn Now.
                </div>

                {messages.map((m) => {
                    if (m.senderType === "system") {
                        return (
                            <div
                                key={m._id}
                                style={{
                                    textAlign: "center",
                                    fontSize: "0.76rem",
                                    color: "#64748b",
                                    margin: "4px 0",
                                }}
                            >
                                {m.text}
                            </div>
                        );
                    }

                    const isMe = (isHost && m.senderType === "creator") || (!isHost && m.senderType === "guest");

                    return (
                        <div
                            key={m._id}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: isMe ? "flex-end" : "flex-start",
                            }}
                        >
                            <span style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "3px", padding: "0 6px" }}>
                                {m.senderAlias}
                            </span>
                            <div
                                style={{
                                    maxWidth: "75%",
                                    padding: "10px 14px",
                                    borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                    background: isMe ? "#f97316" : "rgba(255,255,255,0.07)",
                                    border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)",
                                    color: isMe ? "#ffffff" : "#f1f5f9",
                                    fontSize: "0.92rem",
                                    lineHeight: "1.45",
                                    wordBreak: "break-word",
                                    boxShadow: isMe ? "0 4px 12px rgba(249,115,22,0.25)" : "none",
                                }}
                            >
                                {m.text}
                            </div>
                            <span style={{ fontSize: "0.68rem", color: "#475569", marginTop: "2px", padding: "0 6px" }}>
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                    );
                })}

                {peerTyping && (
                    <div style={{ fontSize: "0.78rem", color: "#f97316", fontStyle: "italic", padding: "4px 8px" }}>
                        {peerTyping}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </main>

            {/* Input Composer */}
            <footer
                style={{
                    padding: "12px 16px",
                    background: "rgba(15, 23, 42, 0.95)",
                    borderTop: "1px solid rgba(255,255,255,0.07)",
                }}
            >
                <form
                    onSubmit={handleSendMessage}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        maxWidth: "768px",
                        margin: "0 auto",
                    }}
                >
                    <input
                        type="text"
                        placeholder="Type an ephemeral message..."
                        value={inputText}
                        onChange={handleInputChange}
                        autoFocus
                        style={{
                            flex: 1,
                            padding: "12px 16px",
                            borderRadius: "14px",
                            background: "rgba(0,0,0,0.35)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#f8fafc",
                            fontSize: "0.92rem",
                            outline: "none",
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        style={{
                            padding: "12px 18px",
                            borderRadius: "14px",
                            background: inputText.trim() ? "#f97316" : "rgba(255,255,255,0.06)",
                            border: "none",
                            color: inputText.trim() ? "#ffffff" : "#64748b",
                            fontWeight: "600",
                            fontSize: "0.9rem",
                            cursor: inputText.trim() ? "pointer" : "default",
                            transition: "all 0.15s",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        Send
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </form>
            </footer>

            {/* Confirmation Modal for Burn Now */}
            {showBurnConfirm && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.7)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                        zIndex: 100,
                    }}
                    onClick={() => setShowBurnConfirm(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: "380px",
                            width: "100%",
                            background: "#0f172a",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "20px",
                            padding: "26px",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "14px",
                                background: "rgba(239, 68, 68, 0.12)",
                                color: "#ef4444",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 14px",
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                            </svg>
                        </div>
                        <h3 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#f8fafc", margin: "0 0 8px" }}>
                            Incinerate Bridge?
                        </h3>
                        <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: "1.5", margin: "0 0 20px" }}>
                            This will instantly destroy all messages for both participants and terminate the connection.
                        </p>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                onClick={() => setShowBurnConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: "11px",
                                    borderRadius: "10px",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    color: "#cbd5e1",
                                    fontWeight: "600",
                                    fontSize: "0.88rem",
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBurnNow}
                                style={{
                                    flex: 1,
                                    padding: "11px",
                                    borderRadius: "10px",
                                    background: "#ef4444",
                                    border: "none",
                                    color: "#ffffff",
                                    fontWeight: "600",
                                    fontSize: "0.88rem",
                                    cursor: "pointer",
                                }}
                            >
                                Burn It
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BurnerChatPage;
