import { useState, useEffect, useRef } from "react";
import { useZenVoiceStore } from "../../stores/zenVoiceStore";
import { ArrowLeft, Send, ShieldAlert, Flag, Bell, BellOff, MessageCircle, MoreVertical, Shield } from "lucide-react";

const ZenVoiceRoom = ({ roomId, onBack, onDMBridgeSuccess }) => {
    const {
        pseudonym: myPseudonym,
        messages,
        memberCount,
        idleWarning,
        resetCountdown,
        purgeLockdown,
        socket,
        fetchMessages,
        leaveRoom,
        restrictMessage,
        reportMessage,
        bridgeDM,
        sendMessageSocket
    } = useZenVoiceStore();

    const [input, setInput] = useState("");
    const [typing, setTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null); // Pseudonym of clicked user
    const [notifSubscribed, setNotifSubscribed] = useState({}); // Per-pseudonym notification settings
    const [menuOpenMessage, setMenuOpenMessage] = useState(null); // ID of message with open context menu
    const [revealedMessages, setRevealedMessages] = useState(new Set()); // IDs of community-blurred messages clicked to reveal
    const [reportingMessage, setReportingMessage] = useState(null); // Message object being formally reported
    const [reportReason, setReportReason] = useState("");
    const [reportEvidence, setReportEvidence] = useState("");
    const [reportSuccess, setReportSuccess] = useState(false);

    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Fetch initial messages on mount
    useEffect(() => {
        fetchMessages(roomId);
    }, [roomId, fetchMessages]);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle typing indicators
    useEffect(() => {
        if (!socket) return;

        const handleTypingStart = ({ roomId: rid, pseudonym: p }) => {
            if (String(rid) === String(roomId) && p !== myPseudonym) {
                setTypingUsers(prev => [...new Set([...prev, p])]);
            }
        };

        const handleTypingStop = ({ roomId: rid, pseudonym: p }) => {
            if (String(rid) === String(roomId)) {
                setTypingUsers(prev => prev.filter(x => x !== p));
            }
        };

        socket.on("typing_start", handleTypingStart);
        socket.on("typing_stop", handleTypingStop);

        return () => {
            socket.off("typing_start", handleTypingStart);
            socket.off("typing_stop", handleTypingStop);
        };
    }, [socket, roomId, myPseudonym]);

    const handleInputChange = (e) => {
        setInput(e.target.value);
        if (!socket) return;

        if (!typing) {
            setTyping(true);
            socket.emit("typing_start", { roomId });
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
            socket.emit("typing_stop", { roomId });
        }, 3000);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        sendMessageSocket(roomId, input.trim(), "text");
        setInput("");

        if (typing) {
            setTyping(false);
            socket?.emit("typing_stop", { roomId });
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };

    const handleRestrict = async (msgId) => {
        await restrictMessage(msgId);
        setMenuOpenMessage(null);
    };

    const handleReportSubmit = async (e) => {
        e.preventDefault();
        if (!reportReason) return;
        const res = await reportMessage(reportingMessage._id, reportReason, reportEvidence);
        if (res.success) {
            setReportSuccess(true);
            setTimeout(() => {
                setReportingMessage(null);
                setReportReason("");
                setReportEvidence("");
                setReportSuccess(false);
            }, 2000);
        }
    };

    const handleDMBridge = async (targetPseudonym) => {
        const res = await bridgeDM(targetPseudonym);
        if (res.success && onDMBridgeSuccess) {
            onDMBridgeSuccess(res.chatId);
        } else {
            alert(res.message || "Failed to start DM.");
        }
    };

    const toggleNotification = (pName) => {
        setNotifSubscribed(prev => ({
            ...prev,
            [pName]: !prev[pName]
        }));
    };

    const activeRoom = useZenVoiceStore.getState().rooms.find(r => r._id === roomId) || {};

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--body-bg, #0b0f19)", position: "relative" }}>
            {/* Purge Lockdown Overlay */}
            {purgeLockdown && (
                <div style={{ position: "absolute", inset: 0, background: "var(--body-bg, #0b0f19)", zIndex: 120000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
                    <Shield size={44} className="animate-pulse" style={{ color: "#f59e0b", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite", marginBottom: "16px" }} />
                    <h2 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: "700", margin: "0 0 8px" }}>Daily Reset</h2>
                    <p style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.85rem", maxWidth: "280px", lineHeight: "1.5", margin: 0 }}>
                        Clearing all messages for today. Access resumes shortly.
                    </p>
                </div>
            )}

            {/* Header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-surface, #0f172a)", zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                        onClick={onBack}
                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start" }}>
                        <span style={{ fontWeight: "700", color: "#fff", fontSize: "1rem" }}>{activeRoom.name || "Room"}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "0.75rem", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                                {memberCount} online
                            </span>
                            {activeRoom.allowedDomain && (
                                <span style={{ fontSize: "0.7rem", color: "#64748b" }}>@{activeRoom.allowedDomain}</span>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => { if (window.confirm("Leave this room? For private rooms, if you are the last member it will nuke the room permanently.")) { leaveRoom(roomId); onBack(); } }}
                    style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        color: "#ef4444",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        cursor: "pointer"
                    }}
                >
                    Leave
                </button>
            </div>

            {/* Countdown / Warning Banners */}
            {(resetCountdown || idleWarning) && (
                <div style={{ background: "var(--color-surface-offset, #161b22)", borderLeft: "3px solid #f59e0b", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
                    <span style={{ fontSize: "0.8rem", color: "#f59e0b", fontWeight: "600" }}>
                        {resetCountdown
                            ? `⚠️ Clean sweep incoming: All posts get deleted in ${resetCountdown} mins.`
                            : `⏳ Crickets here: Wiping room in ${idleWarning} mins due to inactivity.`
                        }
                    </span>
                </div>
            )}

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {messages.map((msg) => {
                    const isOwn = msg.pseudonym === myPseudonym;
                    const isBlurred = msg.globalBlur && !revealedMessages.has(msg._id);

                    return (
                        <div
                            key={msg._id}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignSelf: isOwn ? "flex-end" : "flex-start",
                                maxWidth: "75%",
                                alignItems: isOwn ? "flex-end" : "flex-start",
                                position: "relative"
                            }}
                        >
                            {/* Sender Info (Hidden for own messages) */}
                            {!isOwn && (
                                <div
                                    onClick={() => setSelectedUser(msg.pseudonym)}
                                    style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", cursor: "pointer" }}
                                >
                                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: msg.pseudonymAvatarColor || "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ color: "#000", fontSize: "0.6rem", fontWeight: "bold" }}>
                                            {msg.pseudonym.slice(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: "600" }}>{msg.pseudonym}</span>
                                </div>
                            )}

                            {/* Bubble Container */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {/* Message Context Action Button (Left of bubble for own messages, right for others) */}
                                {!isOwn && (
                                    <button
                                        onClick={() => setMenuOpenMessage(menuOpenMessage === msg._id ? null : msg._id)}
                                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                )}

                                <div
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: "12px",
                                        background: isOwn ? "#f59e0b" : "var(--color-surface, #0f172a)",
                                        color: isOwn ? "#000" : "#fff",
                                        border: isOwn ? "none" : "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                        fontSize: "0.9rem",
                                        lineHeight: "1.4",
                                        textAlign: "left",
                                        position: "relative"
                                    }}
                                >
                                    {isBlurred ? (
                                        <div
                                            onClick={() => setRevealedMessages(prev => new Set([...prev, msg._id]))}
                                            style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                                        >
                                            <ShieldAlert size={16} style={{ color: isOwn ? "#000" : "#ef4444" }} />
                                            <span style={{ fontSize: "0.8rem", fontWeight: "600", textDecoration: "underline" }}>Community flagged this as garbage. Tap to read anyway.</span>
                                        </div>
                                    ) : (
                                        <span>{msg.content}</span>
                                    )}
                                </div>

                                {isOwn && (
                                    <button
                                        onClick={() => setMenuOpenMessage(menuOpenMessage === msg._id ? null : msg._id)}
                                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Message Timestamp & Soft Warnings */}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                {msg.restrictedBy?.length > 0 && isOwn && (
                                    <span title="Your message has been soft-restricted by peers." style={{ display: "inline-flex", alignItems: "center" }}>
                                        <ShieldAlert size={12} style={{ color: "#ef4444" }} />
                                    </span>
                                )}
                                <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            {/* Context Action Menu */}
                            {menuOpenMessage === msg._id && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "100%",
                                        [isOwn ? "right" : "left"]: 0,
                                        zIndex: 100,
                                        background: "var(--color-surface, #0f172a)",
                                        border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                        borderRadius: "8px",
                                        padding: "4px 0",
                                        minWidth: "120px",
                                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)"
                                    }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    {!isOwn && (
                                        <>
                                            <button
                                                onClick={() => handleRestrict(msg._id)}
                                                style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                            >
                                                <ShieldAlert size={14} style={{ color: "#ef4444" }} />
                                                <span>Restrict</span>
                                            </button>
                                            <button
                                                onClick={() => { setReportingMessage(msg); setMenuOpenMessage(null); }}
                                                style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                            >
                                                <Flag size={14} style={{ color: "#f59e0b" }} />
                                                <span>Report</span>
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setMenuOpenMessage(null)}
                                        style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#64748b", fontSize: "0.8rem", textAlign: "left", cursor: "pointer" }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
                <div style={{ padding: "0 16px 8px", fontSize: "0.75rem", color: "#64748b", textAlign: "left" }}>
                    <span>
                        {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing some hot take...
                    </span>
                </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", display: "flex", gap: "10px", background: "var(--color-surface, #0f172a)" }}>
                <input
                    type="text"
                    placeholder={`Say something as ${myPseudonym || "your pseudonym"}...`}
                    value={input}
                    onChange={handleInputChange}
                    style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                        background: "var(--color-surface-offset, #161b22)",
                        color: "#fff",
                        fontSize: "0.88rem",
                        outline: "none",
                        boxSizing: "border-box"
                    }}
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    style={{
                        padding: "10px 16px",
                        borderRadius: "8px",
                        background: input.trim() ? "#f59e0b" : "rgba(255,255,255,0.02)",
                        border: "none",
                        color: input.trim() ? "#000" : "#64748b",
                        fontWeight: "600",
                        cursor: input.trim() ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "0.2s"
                    }}
                >
                    <Send size={18} />
                </button>
            </form>

            {/* Selected User Popover / Modal */}
            {selectedUser && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "340px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "20px", borderRadius: "16px", textAlign: "center", position: "relative" }}>
                        <button
                            onClick={() => setSelectedUser(null)}
                            style={{ position: "absolute", right: "16px", top: "16px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.4rem" }}
                        >
                            &times;
                        </button>

                        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: getPseudonymColor(selectedUser), display: "flex", alignItems: "center", justifyContent: "center", margin: "10px auto 12px" }}>
                            <span style={{ color: "#000", fontWeight: "bold", fontSize: "1.1rem" }}>{selectedUser.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <h4 style={{ margin: "0 0 4px", color: "#fff", fontSize: "1.05rem", fontWeight: "700" }}>{selectedUser}</h4>
                        <span style={{ fontSize: "0.78rem", color: "var(--color-text-faint, #64748b)" }}>Verified Peer</span>
 
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
                            <button
                                onClick={() => handleDMBridge(selectedUser)}
                                style={{
                                    width: "100%",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    background: "#f59e0b",
                                    border: "none",
                                    color: "#000",
                                    fontWeight: "600",
                                    fontSize: "0.85rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px"
                                }}
                            >
                                <MessageCircle size={16} />
                                <span>Message on ZenChat</span>
                            </button>
 
                            <button
                                onClick={() => toggleNotification(selectedUser)}
                                style={{
                                    width: "100%",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    background: "var(--color-surface-offset, #161b22)",
                                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                    color: notifSubscribed[selectedUser] ? "#ef4444" : "#fff",
                                    fontWeight: "600",
                                    fontSize: "0.85rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px"
                                }}
                            >
                                {notifSubscribed[selectedUser] ? <BellOff size={16} /> : <Bell size={16} />}
                                <span>{notifSubscribed[selectedUser] ? "Turn off notifications" : "Notify me when they post"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Formal Report Modal */}
            {reportingMessage && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "380px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative" }}>
                        <h3 style={{ margin: "0 0 16px", color: "#fff", fontSize: "1.1rem", fontWeight: "700", textAlign: "left" }}>
                            Report message
                        </h3>
                        <button
                            onClick={() => { setReportingMessage(null); setReportReason(""); setReportEvidence(""); }}
                            style={{ position: "absolute", right: "20px", top: "20px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.5rem" }}
                        >
                            &times;
                        </button>
 
                        {reportSuccess ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "20px 0" }}>
                                <CheckCircle2 size={36} style={{ color: "#10b981" }} />
                                <span style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Report submitted for administrative review.</span>
                            </div>
                        ) : (
                            <form onSubmit={handleReportSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ textAlign: "left" }}>
                                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)", display: "block", marginBottom: "6px" }}>Select Violation Reason</label>
                                    <select
                                        value={reportReason}
                                        onChange={e => setReportReason(e.target.value)}
                                        required
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                            background: "var(--color-surface-offset, #161b22)",
                                            color: "#fff",
                                            fontSize: "0.85rem",
                                            outline: "none"
                                        }}
                                    >
                                        <option value="">-- Select --</option>
                                        <option value="harassment">Harassment / Bullying</option>
                                        <option value="spam">Spam / Flooding</option>
                                        <option value="hate_speech">Hate Speech</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
 
                                <div style={{ textAlign: "left" }}>
                                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)", display: "block", marginBottom: "4px" }}>Evidence / Context</label>
                                    <textarea
                                        placeholder="What did they do? Be specific..."
                                        value={reportEvidence}
                                        onChange={e => setReportEvidence(e.target.value)}
                                        maxLength={300}
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                            background: "var(--color-surface-offset, #161b22)",
                                            color: "#fff",
                                            fontSize: "0.85rem",
                                            minHeight: "70px",
                                            resize: "vertical",
                                            outline: "none",
                                            boxSizing: "border-box",
                                            fontFamily: "inherit"
                                        }}
                                    />
                                </div>
 
                                <button
                                    type="submit"
                                    disabled={!reportReason}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: "8px",
                                        background: reportReason ? "#f59e0b" : "var(--color-surface-offset, #161b22)",
                                        border: "none",
                                        color: reportReason ? "#000" : "#64748b",
                                        fontWeight: "600",
                                        cursor: reportReason ? "pointer" : "not-allowed",
                                        fontSize: "0.9rem",
                                        marginTop: "8px"
                                    }}
                                >
                                    Submit Report
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZenVoiceRoom;
