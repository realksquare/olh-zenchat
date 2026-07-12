import { useState, useEffect, useRef } from "react";
import { useZenVoiceStore } from "../../stores/zenVoiceStore";
import { useAuthStore } from "../../stores/authStore";
import { ArrowLeft, ChevronLeft, Send, ShieldAlert, Flag, Bell, BellOff, MessageCircle, MoreVertical, Shield, Paperclip, Smile, Loader2, CheckCircle2 } from "lucide-react";
import GifPicker from "../chat/GifPicker";
import axios from "axios";

const ZenVoiceRoom = ({ roomId, onBack, onDMBridgeSuccess }) => {
    const {
        pseudonym: myPseudonym,
        pseudonymColor: myPseudonymColor,
        sessionToken,
        profileData,
        fetchMyProfile,
        updateBio,
        requestPseudonymChange,
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
        sendMessageSocket,
        editMessageSocket,
        deleteMessageSocket,
        toggleStarMessageSocket,
        bulkStarMessagesSocket,
        bulkDeleteMessagesSocket,
        joinRoomSocket,
        clearActiveRoom,
        blockedPseudonyms,
        toggleBlockPseudonym,
        deleteRoom,
        fetchSubscriptions,
        toggleSubscription
    } = useZenVoiceStore();

    const [showRoomOptions, setShowRoomOptions] = useState(false);
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem("zenvoice_mute_" + roomId) === "1");

    const [showMyProfile, setShowMyProfile] = useState(false);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [tempBio, setTempBio] = useState("");
    const [isRequestingName, setIsRequestingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [showNukeConfirm, setShowNukeConfirm] = useState(false);

    useEffect(() => {
        if (sessionToken && showMyProfile) {
            fetchMyProfile().then(data => {
                if (data) setTempBio(data.bio || "");
            });
        }
    }, [fetchMyProfile, sessionToken, showMyProfile]);

    const handleSaveBio = async () => {
        const res = await updateBio(tempBio);
        if (res.success) {
            setIsEditingBio(false);
            showToast("success", "Bio updated successfully");
        } else {
            showToast("error", res.message || "Failed to update bio");
        }
    };

    const handleRequestName = async () => {
        if (!newName.trim()) return;
        const res = await requestPseudonymChange(newName.trim());
        if (res.success) {
            setIsRequestingName(false);
            setNewName("");
            showToast("success", "Pseudonym change requested");
        } else {
            showToast("error", res.message || "Failed to request pseudonym change");
        }
    };

    useEffect(() => {
        const handleDeletedEvent = (e) => {
            if (String(e.detail) === String(roomId)) {
                alert("This room has been deleted by an administrator.");
                onBack();
            }
        };
        window.addEventListener("zenvoice-room-deleted-notify", handleDeletedEvent);
        return () => window.removeEventListener("zenvoice-room-deleted-notify", handleDeletedEvent);
    }, [roomId, onBack]);

    const toggleMuteRoom = () => {
        const newMute = !isMuted;
        setIsMuted(newMute);
        if (newMute) {
            localStorage.setItem("zenvoice_mute_" + roomId, "1");
        } else {
            localStorage.removeItem("zenvoice_mute_" + roomId);
        }
    };

    const handleToggleBlockUser = (pName) => {
        toggleBlockPseudonym(pName);
    };

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
    const [uploading, setUploading] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [replyingToMessage, setReplyingToMessage] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [forwardingMessages, setForwardingMessages] = useState([]);
    const [deletingMessages, setDeletingMessages] = useState([]);
    const [selectedForwardRooms, setSelectedForwardRooms] = useState([]);
    const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());
    const isSelectionMode = selectedMessageIds.size > 0;

    const longPressTimerRef = useRef(null);
    const touchStartRef = useRef({ x: 0, y: 0 });
    const isLongPressActive = useRef(false);

    const handleMessageTouchStart = (e, msgId) => {
        if (isSelectionMode) return;
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        isLongPressActive.current = false;

        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
            isLongPressActive.current = true;
            if (navigator.vibrate) navigator.vibrate(50);
            setMenuOpenMessage(msgId);
        }, 500);
    };

    const handleMessageTouchMove = (e) => {
        if (isSelectionMode) return;
        const touch = e.touches[0];
        const diffX = Math.abs(touch.clientX - touchStartRef.current.x);
        const diffY = Math.abs(touch.clientY - touchStartRef.current.y);
        if (diffX > 10 || diffY > 10) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }
    };

    const handleMessageTouchEnd = (e) => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (isLongPressActive.current) {
            e.preventDefault();
            e.stopPropagation();
            isLongPressActive.current = false;
        }
    };

    const toggleMessageSelection = (msgId) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) {
                next.delete(msgId);
            } else {
                next.add(msgId);
            }
            return next;
        });
    };
    const [toast, setToast] = useState(null);

    const showToast = (type, text) => {
        setToast({ type, text });
    };

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const scrollToMessage = (targetId) => {
        const el = document.getElementById(`msg-${targetId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.style.transition = "background 0.3s";
            const originalBg = el.style.background;
            el.style.background = "rgba(245, 158, 11, 0.25)";
            setTimeout(() => {
                el.style.background = originalBg;
            }, 800);
        }
    };

    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const name = file.name.toLowerCase();
        const isImage = /\.(jpg|jpeg|png|webp)$/i.test(name);
        const isGif = /\.gif$/i.test(name);
        const isDoc = !isImage && !isGif;
        
        let type = "doc";
        let uploadType = "raw";
        if (isImage) {
            type = "image";
            uploadType = "image";
        } else if (isGif) {
            type = "gif";
            uploadType = "image";
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "ml_default");

            const res = await axios.post(
                `https://api.cloudinary.com/v1_1/du4nvei7j/${uploadType}/upload`,
                formData
            );
            const downloadURL = res.data.secure_url;
            sendMessageSocket(roomId, file.name, type, downloadURL);
        } catch (err) {
            console.error("Upload error:", err);
            showToast("error", "Failed to upload file.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleGifSelect = (url, msgType) => {
        sendMessageSocket(roomId, msgType === "sticker" ? "Sticker" : "GIF", msgType, url);
        setShowGifPicker(false);
    };

    // Fetch initial messages and join socket room on mount
    useEffect(() => {
        fetchMessages(roomId);
        joinRoomSocket(roomId);
        fetchSubscriptions(roomId).then(subs => {
            const initialMap = {};
            subs.forEach(p => {
                initialMap[p] = true;
            });
            setNotifSubscribed(initialMap);
        });
        return () => {
            // Clear local state only — do NOT emit leave_room, that's only for the explicit Leave button
            clearActiveRoom();
        };
    }, [roomId, fetchMessages, joinRoomSocket, clearActiveRoom, fetchSubscriptions]);

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

        if (editingMessage) {
            editMessageSocket(editingMessage._id, input.trim());
            setEditingMessage(null);
        } else {
            sendMessageSocket(
                roomId,
                input.trim(),
                "text",
                null,
                replyingToMessage ? replyingToMessage._id : null
            );
            setReplyingToMessage(null);
        }
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
            showToast("error", res.message || "Failed to start DM.");
        }
    };

    const toggleNotification = async (pName) => {
        const res = await toggleSubscription(roomId, pName);
        if (res.success) {
            setNotifSubscribed(prev => ({
                ...prev,
                [pName]: res.subscribed
            }));
            showToast("success", res.subscribed ? `Subscribed to ${pName}` : `Unsubscribed from ${pName}`);
        } else {
            showToast("error", res.message || "Failed to update subscription");
        }
    };

    const rooms = useZenVoiceStore(s => s.rooms || []);
    const activeRoom = rooms.find(r => r._id === roomId) || {};

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--body-bg, #0b0f19)", position: "relative" }}>
            {/* Purge Lockdown Overlay */}
            {purgeLockdown && (
                <div style={{ position: "absolute", inset: 0, background: "var(--body-bg, #0b0f19)", zIndex: 120000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
                    <Shield size={44} className="animate-pulse" style={{ color: "#f59e0b", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite", marginBottom: "16px" }} />
                    <h2 style={{ color: "var(--color-text, #fff)", fontSize: "1.2rem", fontWeight: "700", margin: "0 0 8px" }}>Daily Reset</h2>
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
                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", flexShrink: 0 }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start" }}>
                        <span style={{ fontWeight: "700", color: "var(--color-text, #fff)", fontSize: "1rem" }}>{activeRoom.name || "Room"}</span>
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

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Own Profile Chip */}
                    <div
                        onClick={() => setShowMyProfile(true)}
                        style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: myPseudonymColor || "#f59e0b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                            border: "2px solid var(--color-border, rgba(255, 255, 255, 0.15))"
                        }}
                        title="My ZenVoice Profile"
                    >
                        <span style={{ color: "#000", fontSize: "0.72rem", fontWeight: "bold" }}>
                            {(myPseudonym || "ME").slice(0, 2).toUpperCase()}
                        </span>
                    </div>

                    <button
                        onClick={() => setShowRoomOptions(true)}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: "6px"
                        }}
                        title="Room Options"
                    >
                        <MoreVertical size={20} />
                    </button>
                </div>
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
                    const isBlockedUser = blockedPseudonyms?.has(msg.pseudonym);
                    const isBlurred = (msg.globalBlur || isBlockedUser) && !revealedMessages.has(msg._id);
                    const isDeletedForMe = msg.deletedFor?.includes(myPseudonym);
                    const isSelected = selectedMessageIds.has(msg._id);
                    const isStarredByMe = msg.starredBy?.includes(myPseudonym);

                    if (isDeletedForMe) return null;

                    if (msg.deletedForEveryone) {
                        return (
                            <div className={`message-row ${isOwn ? "mine" : "theirs"}`} key={msg._id} id={`msg-${msg._id}`}>
                                {!isOwn && (
                                    <div
                                        style={{
                                            width: "36px",
                                            height: "36px",
                                            borderRadius: "50%",
                                            background: msg.pseudonymAvatarColor || "#3b82f6",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            alignSelf: "flex-end",
                                            marginBottom: "4px"
                                        }}
                                    >
                                        <span style={{ color: "#000", fontSize: "0.85rem", fontWeight: "bold" }}>
                                            {msg.pseudonym.slice(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="message-bubble-outer">
                                    {!isOwn && (
                                        <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted, #94a3b8)", fontWeight: "600", marginBottom: "2px", display: "block" }}>
                                            {msg.pseudonym}
                                        </span>
                                    )}
                                    <div className="message-bubble deleted-bubble" style={{ padding: "10px 14px" }}>
                                        <span className="deleted-text">This message was deleted</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div className={`message-row ${isOwn ? "mine" : "theirs"}`} key={msg._id} id={`msg-${msg._id}`}>
                            {isSelectionMode && (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleMessageSelection(msg._id);
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: "10px",
                                        cursor: "pointer",
                                        flexShrink: 0
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "18px",
                                            height: "18px",
                                            borderRadius: "4px",
                                            border: "2px solid #64748b",
                                            borderColor: isSelected ? "#f59e0b" : "#64748b",
                                            background: isSelected ? "#f59e0b" : "transparent",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.2s"
                                        }}
                                    >
                                        {isSelected && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* Avatar (Only for other users) */}
                            {!isOwn && (
                                <div
                                    onClick={() => setSelectedUser(msg.pseudonym)}
                                    style={{
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "50%",
                                        background: msg.pseudonymAvatarColor || "#3b82f6",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        flexShrink: 0,
                                        alignSelf: "flex-end",
                                        marginBottom: "4px"
                                    }}
                                >
                                    <span style={{ color: "#000", fontSize: "0.85rem", fontWeight: "bold" }}>
                                        {msg.pseudonym.slice(0, 2).toUpperCase()}
                                    </span>
                                </div>
                            )}

                            {/* Bubble Outer */}
                            <div className="message-bubble-outer" style={{ position: "relative" }}>
                                {/* Sender Name */}
                                {!isOwn && (
                                    <span
                                        onClick={() => setSelectedUser(msg.pseudonym)}
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "var(--color-text-muted, #94a3b8)",
                                            fontWeight: "600",
                                            marginBottom: "2px",
                                            cursor: "pointer",
                                            display: "block"
                                        }}
                                    >
                                        {msg.pseudonym}
                                    </span>
                                )}

                                <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                                    <div
                                        className={`message-bubble ${isOwn ? "mine status-seen" : "theirs"} ${msg.type === "sticker" ? "is-sticker" : ""}`}
                                        onClick={(e) => {
                                            if (isSelectionMode) {
                                                e.stopPropagation();
                                                toggleMessageSelection(msg._id);
                                            }
                                        }}
                                        onTouchStart={(e) => handleMessageTouchStart(e, msg._id)}
                                        onTouchMove={handleMessageTouchMove}
                                        onTouchEnd={handleMessageTouchEnd}
                                        style={{
                                            background: msg.type === "sticker" ? "transparent" : undefined,
                                            border: msg.type === "sticker" ? "none" : undefined,
                                            padding: msg.type === "sticker" ? "0" : undefined,
                                            cursor: isSelectionMode ? "pointer" : undefined
                                        }}
                                    >
                                        {msg.replyTo && (
                                            <div
                                                className="replied-message-preview"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    scrollToMessage(msg.replyTo._id || msg.replyTo);
                                                }}
                                            >
                                                <div className="replied-sender">
                                                    {msg.replyTo.pseudonym === myPseudonym ? "You" : msg.replyTo.pseudonym}
                                                </div>
                                                <div className="replied-content">
                                                    {msg.replyTo.deletedForEveryone ? "Original message deleted" : (msg.replyTo.content || (
                                                        msg.replyTo.type === 'image' ? 'Image' :
                                                        msg.replyTo.type === 'gif' ? 'GIF' :
                                                        msg.replyTo.type === 'sticker' ? 'Sticker' :
                                                        msg.replyTo.type === 'doc' ? 'Document' :
                                                        'Media'
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {isBlurred ? (
                                            <div
                                                onClick={() => setRevealedMessages(prev => new Set([...prev, msg._id]))}
                                                style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                                            >
                                                <ShieldAlert size={16} style={{ color: isOwn ? "#000" : "#ef4444" }} />
                                                <span style={{ fontSize: "0.8rem", fontWeight: "600", textDecoration: "underline" }}>
                                                    {isBlockedUser ? "You muted this user. Tap to reveal post anyway." : "Community flagged this as garbage. Tap to read anyway."}
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                {(msg.type === "image" || msg.type === "gif") && (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                        <img
                                                            src={msg.mediaUrl}
                                                            alt={msg.content || "Media"}
                                                            style={{ maxWidth: "100%", maxHeight: "250px", borderRadius: "8px", objectFit: "contain", cursor: "pointer" }}
                                                            onClick={() => window.open(msg.mediaUrl, "_blank")}
                                                        />
                                                        {msg.content && msg.content !== "GIF" && msg.content !== "Sticker" && (
                                                            <span style={{ fontSize: "0.85rem", display: "block" }}>{msg.content}</span>
                                                        )}
                                                    </div>
                                                )}
                                                {msg.type === "sticker" && (
                                                    <img
                                                        src={msg.mediaUrl}
                                                        alt="Sticker"
                                                        style={{ width: "120px", height: "120px", objectFit: "contain" }}
                                                    />
                                                )}
                                                {msg.type === "doc" && (
                                                    <a
                                                        href={msg.mediaUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ display: "flex", alignItems: "center", gap: "8px", color: isOwn ? "#000" : "#3da5d9", textDecoration: "none" }}
                                                    >
                                                        <Paperclip size={18} />
                                                        <span style={{ textDecoration: "underline", fontSize: "0.85rem" }}>{msg.content}</span>
                                                    </a>
                                                )}
                                                {(!msg.type || msg.type === "text") && (
                                                    <span>{msg.content}</span>
                                                )}
                                            </>
                                        )}
                                    </div>

                                </div>

                                {/* Message Timestamp & Soft Warnings */}
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                    {msg.restrictedBy?.length > 0 && isOwn && (
                                        <span title="Your message has been soft-restricted by peers." style={{ display: "inline-flex", alignItems: "center" }}>
                                            <ShieldAlert size={12} style={{ color: "#ef4444" }} />
                                        </span>
                                    )}
                                    {isStarredByMe && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" style={{ flexShrink: 0 }}>
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
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
                                        {/* Reply */}
                                        <button
                                            onClick={() => {
                                                setReplyingToMessage(msg);
                                                setMenuOpenMessage(null);
                                            }}
                                            style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                <polyline points="9 17 4 12 9 7" />
                                                <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                                            </svg>
                                            <span>Reply</span>
                                        </button>

                                        {/* Edit (only text type for own messages) */}
                                        {isOwn && (!msg.type || msg.type === "text") && (
                                            <button
                                                onClick={() => {
                                                    setEditingMessage(msg);
                                                    setInput(msg.content);
                                                    setMenuOpenMessage(null);
                                                }}
                                                style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                <span>Edit</span>
                                            </button>
                                        )}



                                        {/* Select */}
                                        <button
                                            onClick={() => {
                                                setSelectedMessageIds(new Set([msg._id]));
                                                setMenuOpenMessage(null);
                                            }}
                                            style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                <path d="M9 11l3 3L22 4" />
                                            </svg>
                                            <span>Select</span>
                                        </button>

                                        {/* Forward */}
                                        <button
                                            onClick={() => {
                                                setForwardingMessages([msg]);
                                                setSelectedForwardRooms([]);
                                                setMenuOpenMessage(null);
                                            }}
                                            style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                <polyline points="15 10 20 15 15 20" />
                                                <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                                            </svg>
                                            <span>Forward</span>
                                        </button>

                                        {/* Copy */}
                                        {msg.content && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(msg.content);
                                                    setMenuOpenMessage(null);
                                                    showToast("success", "Copied to clipboard");
                                                }}
                                                style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                                <span>Copy</span>
                                            </button>
                                        )}

                                        {/* Copy Link */}
                                        {msg.mediaUrl && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(msg.mediaUrl);
                                                    setMenuOpenMessage(null);
                                                    showToast("success", "Link copied");
                                                }}
                                                style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                                </svg>
                                                <span>Copy link</span>
                                            </button>
                                        )}

                                        {/* Delete */}
                                        <button
                                            onClick={() => {
                                                setDeletingMessages([msg]);
                                                setMenuOpenMessage(null);
                                            }}
                                            style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: "#cbd5e1", fontSize: "0.8rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                            <span style={{ color: "#ef4444" }}>Delete</span>
                                        </button>

                                        {/* Restrict / Report (only for other users) */}
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


                                    </div>
                                )}
                            </div>
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

            {/* Reply / Edit preview banners */}
            {replyingToMessage && (
                <div className="reply-preview-container" style={{ margin: "0 16px 8px" }}>
                    <div className="reply-info">
                        <div className="reply-to-user">
                            Replying to {replyingToMessage.pseudonym === myPseudonym ? "yourself" : replyingToMessage.pseudonym}
                        </div>
                        <div className="reply-to-text">
                            {replyingToMessage.type === "image" ? "Image" :
                             replyingToMessage.type === "video" ? "Video" :
                             replyingToMessage.type === "voice" ? "Voice message" :
                             replyingToMessage.type === "sticker" ? "Sticker" :
                             replyingToMessage.type === "gif" ? "GIF" :
                             replyingToMessage.content}
                        </div>
                    </div>
                    <button className="reply-cancel-btn" onClick={() => setReplyingToMessage(null)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {editingMessage && (
                <div className="reply-preview-container" style={{ margin: "0 16px 8px" }}>
                    <div className="reply-info">
                        <div className="reply-to-user" style={{ color: "var(--color-primary)" }}>
                            Editing message
                        </div>
                        <div className="reply-to-text">
                            {editingMessage.content}
                        </div>
                    </div>
                    <button className="reply-cancel-btn" onClick={() => { setEditingMessage(null); setInput(""); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Selection Action Bar or Normal Message Input */}
            {isSelectionMode ? (
                <div style={{
                    padding: "12px 16px",
                    borderTop: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--color-surface-offset, #161b22)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            onClick={() => setSelectedMessageIds(new Set())}
                            style={{
                                background: "none",
                                border: "none",
                                color: "#cbd5e1",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "0.85rem"
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            <span>Cancel ({selectedMessageIds.size})</span>
                        </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                        {/* Fav Action */}
                        <button
                            onClick={() => {
                                bulkStarMessagesSocket(roomId, Array.from(selectedMessageIds));
                                setSelectedMessageIds(new Set());
                                showToast("success", "Selected messages marked as favorite");
                            }}
                            title="Favorite"
                            style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", display: "flex", alignItems: "center" }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                        </button>

                        {/* Forward Action */}
                        <button
                            onClick={() => {
                                const selectedMsgs = messages.filter(m => selectedMessageIds.has(m._id));
                                setForwardingMessages(selectedMsgs);
                                setSelectedForwardRooms([]);
                            }}
                            title="Forward"
                            style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", display: "flex", alignItems: "center" }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 10 20 15 15 20" />
                                <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                            </svg>
                        </button>

                        {/* Delete Action */}
                        <button
                            onClick={() => {
                                const selectedMsgs = messages.filter(m => selectedMessageIds.has(m._id));
                                setDeletingMessages(selectedMsgs);
                            }}
                            title="Delete"
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSendMessage} style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", display: "flex", alignItems: "center", gap: "10px", background: "var(--color-surface, #0f172a)" }}>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{ background: "none", border: "none", color: "var(--color-text-muted, #94a3b8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", flexShrink: 0 }}
                    >
                        {uploading ? <Loader2 className="animate-spin" size={20} style={{ animation: "spin 1s linear infinite" }} /> : <Paperclip size={20} />}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowGifPicker(true)}
                        disabled={uploading}
                        style={{ background: "none", border: "none", color: "var(--color-text-muted, #94a3b8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", flexShrink: 0 }}
                    >
                        <Smile size={20} />
                    </button>

                    <input
                        type="text"
                        placeholder={`Say something as ${myPseudonym || "your pseudonym"}...`}
                        value={input}
                        onChange={handleInputChange}
                        disabled={uploading}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                            background: "var(--color-surface-offset, #161b22)",
                            color: "var(--color-text, #fff)",
                            fontSize: "0.88rem",
                            outline: "none",
                            boxSizing: "border-box"
                        }}
                    />

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.zip,.rar,.txt"
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                    />

                    <button
                        type="submit"
                        disabled={!input.trim() || uploading}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            background: input.trim() && !uploading ? "#f59e0b" : "rgba(255,255,255,0.02)",
                            border: "none",
                            color: input.trim() && !uploading ? "#000" : "#64748b",
                            fontWeight: "600",
                            cursor: input.trim() && !uploading ? "pointer" : "not-allowed",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "0.2s",
                            flexShrink: 0
                        }}
                    >
                        <Send size={18} />
                    </button>
                </form>
            )}

            {showGifPicker && (
                <GifPicker
                    onClose={() => setShowGifPicker(false)}
                    onSelect={handleGifSelect}
                />
            )}

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
                        <h4 style={{ margin: "0 0 4px", color: "var(--color-text, #fff)", fontSize: "1.05rem", fontWeight: "700" }}>{selectedUser}</h4>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "0.78rem", color: "var(--color-text-faint, #64748b)" }}>Verified Student</span>
                            {activeRoom.allowedDomain && (
                                <span style={{ fontSize: "0.75rem", color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                                    @{activeRoom.allowedDomain}
                                </span>
                            )}
                        </div>

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

                            <button
                                onClick={() => {
                                    handleToggleBlockUser(selectedUser);
                                    setSelectedUser(null);
                                }}
                                style={{
                                    width: "100%",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    background: blockedPseudonyms?.has(selectedUser) ? "rgba(239, 68, 68, 0.15)" : "var(--color-surface-offset, #161b22)",
                                    border: blockedPseudonyms?.has(selectedUser) ? "1px solid #ef4444" : "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                    color: "#ef4444",
                                    fontWeight: "600",
                                    fontSize: "0.85rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px"
                                }}
                            >
                                <span>{blockedPseudonyms?.has(selectedUser) ? "Unmute Peer" : "Mute Peer (Hide Messages)"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Formal Report Modal */}
            {reportingMessage && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "380px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative" }}>
                        <h3 style={{ margin: "0 0 16px", color: "var(--color-text, #fff)", fontSize: "1.1rem", fontWeight: "700", textAlign: "left" }}>
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
                                            color: "var(--color-text, #fff)",
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
                                            color: "var(--color-text, #fff)",
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

            {/* Custom Leave Room Confirmation Modal */}
            {showLeaveConfirm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "380px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative", textAlign: "center" }}>
                        <h3 style={{ margin: "0 0 12px", color: "var(--color-text, #fff)", fontSize: "1.1rem", fontWeight: "700" }}>
                            Leave Room?
                        </h3>
                        <p style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.85rem", lineHeight: "1.5", margin: "0 0 20px" }}>
                            For private rooms, if you are the last member it will nuke the room permanently.
                        </p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            <button
                                onClick={() => setShowLeaveConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: "10px",
                                    borderRadius: "8px",
                                    background: "var(--color-surface-offset, #161b22)",
                                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                    color: "#cbd5e1",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: "0.85rem"
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowLeaveConfirm(false);
                                    leaveRoom(roomId);
                                    onBack();
                                }}
                                style={{
                                    flex: 1,
                                    padding: "10px",
                                    borderRadius: "8px",
                                    background: "#ef4444",
                                    border: "none",
                                    color: "var(--color-text, #fff)",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: "0.85rem"
                                }}
                            >
                                Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Forward Modal */}
            {forwardingMessages.length > 0 && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "380px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
                        <h3 style={{ margin: "0 0 16px", color: "var(--color-text, #fff)", fontSize: "1.1rem", fontWeight: "700" }}>
                            Forward {forwardingMessages.length === 1 ? "Message" : `${forwardingMessages.length} Messages`}
                        </h3>
                        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                            {useZenVoiceStore.getState().rooms.map(room => {
                                const isSelected = selectedForwardRooms.includes(room._id);
                                return (
                                    <div
                                        key={room._id}
                                        onClick={() => {
                                            setSelectedForwardRooms(prev =>
                                                prev.includes(room._id) ? prev.filter(id => id !== room._id) : [...prev, room._id]
                                            );
                                        }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "12px",
                                            borderRadius: "8px",
                                            background: isSelected ? "rgba(245, 158, 11, 0.15)" : "var(--color-surface-offset, #161b22)",
                                            border: isSelected ? "1px solid #f59e0b" : "1px solid transparent",
                                            cursor: "pointer",
                                            transition: "all 0.2s"
                                        }}
                                    >
                                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left" }}>
                                            <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--color-text, #fff)" }}>{room.name}</span>
                                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                                {room.isOfficial ? "Official Channel" : "Student Hideout"}
                                            </span>
                                        </div>
                                        {isSelected && (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button
                                onClick={() => { setForwardingMessages([]); setSelectedForwardRooms([]); }}
                                style={{
                                    flex: 1,
                                    padding: "10px",
                                    borderRadius: "8px",
                                    background: "var(--color-surface-offset, #161b22)",
                                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                    color: "#cbd5e1",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: "0.85rem"
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedForwardRooms.length > 0 && forwardingMessages.length > 0) {
                                        selectedForwardRooms.forEach(rid => {
                                            forwardingMessages.forEach(fMsg => {
                                                sendMessageSocket(rid, fMsg.content, fMsg.type, fMsg.mediaUrl);
                                            });
                                        });
                                        setForwardingMessages([]);
                                        setSelectedForwardRooms([]);
                                        setSelectedMessageIds(new Set());
                                        showToast("success", `Messages forwarded to ${selectedForwardRooms.length} room(s)`);
                                    }
                                }}
                                disabled={selectedForwardRooms.length === 0}
                                style={{
                                    flex: 1,
                                    padding: "10px",
                                    borderRadius: "8px",
                                    background: selectedForwardRooms.length > 0 ? "#f59e0b" : "var(--color-surface-offset, #161b22)",
                                    border: "none",
                                    color: selectedForwardRooms.length > 0 ? "#000" : "#64748b",
                                    fontWeight: "600",
                                    cursor: selectedForwardRooms.length > 0 ? "pointer" : "not-allowed",
                                    fontSize: "0.85rem"
                                }}
                            >
                                Forward
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Delete Message Modal */}
            {deletingMessages.length > 0 && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "380px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative", textAlign: "center" }}>
                        <h3 style={{ margin: "0 0 12px", color: "var(--color-text, #fff)", fontSize: "1.1rem", fontWeight: "700" }}>
                            Delete {deletingMessages.length === 1 ? "message?" : `${deletingMessages.length} messages?`}
                        </h3>
                        <p style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.85rem", lineHeight: "1.5", margin: "0 0 20px" }}>
                            Selected messages will be removed from your chat view.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <button
                                onClick={() => {
                                    const ids = deletingMessages.map(m => m._id);
                                    bulkDeleteMessagesSocket(roomId, ids, "me");
                                    setDeletingMessages([]);
                                    setSelectedMessageIds(new Set());
                                }}
                                style={{
                                    padding: "11px",
                                    borderRadius: "8px",
                                    background: "var(--color-surface-offset, #161b22)",
                                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                    color: "var(--color-text, #fff)",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: "0.85rem"
                                }}
                            >
                                Delete for me
                            </button>
                            {deletingMessages.every(m => m.pseudonym === myPseudonym) && (
                                <button
                                    onClick={() => {
                                        const ids = deletingMessages.map(m => m._id);
                                        bulkDeleteMessagesSocket(roomId, ids, "everyone");
                                        setDeletingMessages([]);
                                        setSelectedMessageIds(new Set());
                                    }}
                                    style={{
                                        padding: "11px",
                                        borderRadius: "8px",
                                        background: "#ef4444",
                                        border: "none",
                                        color: "var(--color-text, #fff)",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        fontSize: "0.85rem"
                                    }}
                                >
                                    Delete for everyone
                                </button>
                            )}
                            <button
                                onClick={() => setDeletingMessages([])}
                                style={{
                                    padding: "10px",
                                    borderRadius: "8px",
                                    background: "transparent",
                                    border: "none",
                                    color: "#64748b",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    marginTop: "4px"
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Room Options Bottom Sheet / Modal */}
            {showRoomOptions && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "360px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative", color: "var(--color-text, #fff)" }}>
                        <button
                            onClick={() => setShowRoomOptions(false)}
                            style={{ position: "absolute", right: "20px", top: "20px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.5rem" }}
                        >
                            &times;
                        </button>
                        
                        <h3 style={{ margin: "0 0 16px", fontWeight: "700", borderBottom: "1px solid var(--color-border, rgba(255, 255, 255, 0.05))", paddingBottom: "8px" }}>
                            Room Options
                        </h3>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "0.85rem", textAlign: "left" }}>
                            <div>
                                <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block" }}>Room Name</span>
                                <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>{activeRoom.name}</span>
                            </div>

                            {activeRoom.description && (
                                <div>
                                    <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block" }}>Description</span>
                                    <span>{activeRoom.description}</span>
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <div>
                                    <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block" }}>Domain Lock</span>
                                    <span>{activeRoom.allowedDomain ? `@${activeRoom.allowedDomain}` : "Public"}</span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block" }}>Members</span>
                                    <span>{memberCount} online</span>
                                </div>
                            </div>

                            {!activeRoom.isOfficial && (
                                <div>
                                    <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block", marginBottom: "4px" }}>Room Invite Link</span>
                                    <div style={{ display: "flex", alignItems: "center", background: "var(--color-surface-offset, #161b22)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", borderRadius: "8px", padding: "8px 12px" }}>
                                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8rem", color: "var(--color-text-faint, #64748b)", textAlign: "left" }}>
                                            {window.location.origin}/zenvoice/invite/{activeRoom.inviteToken}
                                        </span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/zenvoice/invite/${activeRoom.inviteToken}`);
                                                showToast("success", "Invite link copied!");
                                            }}
                                            style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                                <button
                                    onClick={toggleMuteRoom}
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        borderRadius: "8px",
                                        background: "var(--color-surface-offset, #161b22)",
                                        border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                        color: isMuted ? "#f59e0b" : "#fff",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px"
                                    }}
                                >
                                    <span>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setShowRoomOptions(false);
                                        setShowLeaveConfirm(true);
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        borderRadius: "8px",
                                        background: "rgba(239, 68, 68, 0.1)",
                                        border: "1px solid rgba(239, 68, 68, 0.2)",
                                        color: "#ef4444",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px"
                                    }}
                                >
                                    <span>Leave Room</span>
                                </button>

                                {((activeRoom.creatorPseudonym === myPseudonym && !activeRoom.isOfficial) || useAuthStore.getState().user?.role === "master_admin" || useAuthStore.getState().user?.role === "co_admin") && (
                                    <button
                                        onClick={() => {
                                            setShowRoomOptions(false);
                                            setShowNukeConfirm(true);
                                        }}
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            background: "#ef4444",
                                            border: "none",
                                            color: "#000",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "6px"
                                        }}
                                    >
                                        <span>Delete Room (Nuke)</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Toast Alert */}
            {toast && (
                <div className={`zen-toast zen-toast-${toast.type}`} style={{ pointerEvents: "auto" }}>
                    {toast.type === "success" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                    {toast.type === "error" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                    )}
                    <span>{toast.text}</span>
                </div>
            )}
            {/* My ZenVoice Profile Modal */}
            {showMyProfile && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyValue: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "360px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative", color: "var(--color-text, #fff)" }}>
                        <button
                            onClick={() => setShowMyProfile(false)}
                            style={{ position: "absolute", right: "20px", top: "20px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.5rem" }}
                        >
                            &times;
                        </button>
                        
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", textAlign: "center", marginBottom: "20px" }}>
                            <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: myPseudonymColor || "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ color: "#000", fontWeight: "bold", fontSize: "1.3rem" }}>{(myPseudonym || "ME").slice(0, 2).toUpperCase()}</span>
                            </div>
                            <h3 style={{ margin: "4px 0 2px", fontWeight: "700" }}>{myPseudonym}</h3>
                            <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#10b981", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "12px", fontWeight: "600" }}>
                                Verified Peer
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "0.85rem", textAlign: "left" }}>
                            <div>
                                <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block" }}>College / Institution</span>
                                <span style={{ fontWeight: "600" }}>{profileData?.collegeName || "Unknown Institution"}</span>
                            </div>

                            <div>
                                <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block" }}>Student Domain</span>
                                <span style={{ fontWeight: "600" }}>@{profileData?.collegeEmailDomain || "domain"}</span>
                            </div>

                            <div>
                                <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block", marginBottom: "4px" }}>My Bio</span>
                                {isEditingBio ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <textarea
                                            value={tempBio}
                                            onChange={(e) => setTempBio(e.target.value)}
                                            maxLength={100}
                                            style={{
                                                width: "100%",
                                                padding: "8px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.1))",
                                                background: "var(--color-surface-offset, #161b22)",
                                                color: "var(--color-text, #fff)",
                                                fontSize: "0.85rem",
                                                minHeight: "44px",
                                                resize: "vertical",
                                                fontFamily: "inherit",
                                                boxSizing: "border-box",
                                                outline: "none"
                                            }}
                                        />
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                onClick={handleSaveBio}
                                                style={{ padding: "4px 10px", borderRadius: "4px", background: "#f59e0b", border: "none", color: "#000", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setIsEditingBio(false)}
                                                style={{ padding: "4px 10px", borderRadius: "4px", background: "transparent", border: "1px solid var(--color-border, rgba(255,255,255,0.1))", color: "#cbd5e1", fontSize: "0.75rem", cursor: "pointer" }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyValue: "center", justifyContent: "space-between", gap: "8px", background: "var(--color-surface-offset, #161b22)", padding: "8px 10px", borderRadius: "6px" }}>
                                        <span style={{ fontStyle: tempBio ? "normal" : "italic", color: tempBio ? "var(--color-text)" : "var(--color-text-muted)" }}>
                                            {tempBio || "Tell them something sarcastic..."}
                                        </span>
                                        <button
                                            onClick={() => setIsEditingBio(true)}
                                            style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: "0.75rem", padding: "2px" }}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                )}
                            </div>

                            {profileData?.redCardCount > 0 && (
                                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", padding: "10px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                                    <div>
                                        <div style={{ fontWeight: "700", color: "#ef4444", fontSize: "0.8rem" }}>Red Cards: {profileData.redCardCount}</div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted, #94a3b8)", marginTop: "2px" }}>You have been flagged for trash content. Exponential timeouts apply. Keep it clean.</div>
                                    </div>
                                </div>
                            )}

                            <div style={{ borderTop: "1px solid var(--color-border, rgba(255, 255, 255, 0.05))", paddingTop: "14px", marginTop: "6px" }}>
                                {profileData?.pseudonymChangeRequest?.requested ? (
                                    <div style={{ background: "var(--color-surface-offset, #161b22)", padding: "10px", borderRadius: "8px", fontSize: "0.78rem", color: "var(--color-text-muted, #94a3b8)" }}>
                                        <span>Pseudonym change request to <strong>{profileData.pseudonymChangeRequest.desiredPseudonym}</strong> is <strong>{profileData.pseudonymChangeRequest.status}</strong>.</span>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted, #94a3b8)" }}>Want a new identity?</span>
                                        {isRequestingName ? (
                                            <div style={{ display: "flex", gap: "6px" }}>
                                                <input
                                                    type="text"
                                                    placeholder="Desired pseudonym"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    style={{ flex: 1, padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--color-border, rgba(255,255,255,0.1))", background: "var(--color-surface-offset, #161b22)", color: "#fff", fontSize: "0.8rem", outline: "none" }}
                                                />
                                                <button
                                                    onClick={handleRequestName}
                                                    style={{ padding: "6px 10px", borderRadius: "4px", background: "#f59e0b", border: "none", color: "#000", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                                                >
                                                    Submit
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsRequestingName(true)}
                                                style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "transparent", border: "1px dashed var(--color-border, rgba(255,255,255,0.15))", color: "#f59e0b", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}
                                            >
                                                Request Pseudonym Change
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Nuke Confirmation Modal */}
            {showNukeConfirm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "380px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative", textAlign: "center", color: "var(--color-text, #fff)" }}>
                        <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem", fontWeight: "700", color: "#f8fafc" }}>Nuke Room?</h3>
                        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted, #94a3b8)", marginBottom: "20px", lineHeight: "1.5" }}>
                            This will nuke the room, permanently deleting all messages and media. This action cannot be undone.
                        </p>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button
                                onClick={() => setShowNukeConfirm(false)}
                                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setShowNukeConfirm(false);
                                    const res = await deleteRoom(roomId);
                                    if (res.success) {
                                        onBack();
                                    } else {
                                        showToast("error", res.message || "Failed to delete room.");
                                    }
                                }}
                                style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#ef4444", border: "none", color: "#000", cursor: "pointer", fontWeight: "700", fontSize: "0.85rem" }}
                            >
                                Nuke
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZenVoiceRoom;
