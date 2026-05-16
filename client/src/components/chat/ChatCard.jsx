import { useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";
import { useMomentStore } from "../../stores/momentStore";
import { formatDistanceToNow } from "date-fns";
import { VerifiedTick } from "../ui/Icons";
import axiosInstance from "../../utils/axios";

const ChatCard = ({ chat, isActive, onSelect, onPin, isPinned }) => {
    // ── Store subscriptions ───────────────────────────────────────────────────
    const { user, toggleContact } = useAuthStore();
    const typingUsers = useChatStore((s) => s.typingUsers);
    const onlineUsers = useChatStore((s) => s.onlineUsers);
    const unreadCount = useChatStore((s) => s.unreadCounts[chat._id] || 0);
    const deleteChatForUser = useChatStore((s) => s.deleteChatForUser);
    const liveChat = useChatStore((s) => s.chats.find((c) => c._id === chat._id)) || chat;
    const storeMessages = useChatStore((s) => s.messages[chat._id] || []);
    const hasActiveMoment = useMomentStore((s) => s.hasActiveMoment);

    // ── Local state & refs ────────────────────────────────────────────────────
    const [showUserCard, setShowUserCard] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [contactLoading, setContactLoading] = useState(false);
    const [showDeletePrompt, setShowDeletePrompt] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const pressTimer = useRef(null);

    // ── Derived participant data ───────────────────────────────────────────────
    const otherParticipant = liveChat.participants?.find((p) => {
        const pid = p?._id?.toString() || p?.toString();
        return pid && pid !== user?._id?.toString();
    });

    const isDeleted = !otherParticipant
        || typeof otherParticipant === "string"
        || !otherParticipant.username;

    const otherUser = isDeleted ? null : otherParticipant;
    const otherUserId = otherUser?._id?.toString()
        || otherParticipant?._id?.toString()
        || otherParticipant?.toString();

    const chatTyping = typingUsers[liveChat._id];
    const isTyping = !!(chatTyping && otherUserId && chatTyping[otherUserId]);
    const typingScramble = isTyping ? chatTyping[otherUserId] : null;
    const isOnline = otherUser?.isOnline || (otherUserId && onlineUsers.has(otherUserId.toString()));
    const hasMoments = !!(otherUserId && hasActiveMoment(otherUserId.toString()));
    const isContact = !!(user?.contacts?.some(c => {
        const uid = c.userId?._id?.toString() || c.userId?.toString();
        return uid === otherUserId;
    }));
    const isDeletedUser = (otherUser?.username || "").includes("(user_deleted)");
    const displayName = isDeleted || isDeletedUser ? "(user_deleted)" : (otherUser?.username ?? "");


    // ── Last-message preview ──────────────────────────────────────────────────
    const isLastMessageFromThem =
        liveChat.lastMessage?.senderId !== user?._id &&
        liveChat.lastMessage?.senderId?._id !== user?._id;
    const isLastMessageUnread =
        isLastMessageFromThem &&
        liveChat.lastMessage?.status !== "read" &&
        !liveChat.lastMessage?.deletedForEveryone &&
        (liveChat.lastMessage?.content || liveChat.lastMessage?.mediaUrl || liveChat.lastMessage?.music);
    const hasUnread = unreadCount > 0 || isLastMessageUnread;
    const displayUnreadCount = unreadCount > 0 ? unreadCount : (isLastMessageUnread ? 1 : 0);

    const getPreview = () => {
        if (isTyping) {
            return { text: typeof typingScramble === "string" ? typingScramble : "typing...", isUnread: true };
        }
        if (hasUnread) {
            if (displayUnreadCount === 1 && liveChat.lastMessage?.content)
                return { text: liveChat.lastMessage.content, isUnread: true };
            if (displayUnreadCount <= 3)
                return { text: `${displayUnreadCount} new ${displayUnreadCount === 1 ? "message" : "messages"}`, isUnread: true };
            return { text: "3+ new messages", isUnread: true };
        }
        const effectiveLastMsg = liveChat.lastMessage || (() => {
            const visible = storeMessages
                .filter(m => !m.deletedForEveryone && m.status !== "sending")
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return visible[0] || null;
        })();
        if (!effectiveLastMsg) return { text: "No messages yet", isUnread: false };
        const { content, type, senderId } = effectiveLastMsg;
        const isMe = senderId?._id === user?._id || senderId === user?._id;
        if (type === "image") return { text: isMe ? "You sent an image" : "Sent an image", isUnread: false };
        if (type === "video") return { text: isMe ? "You sent a video" : "Sent a video", isUnread: false };
        return { text: isMe ? `You: ${content}` : content, isUnread: false };
    };
    const preview = getPreview();

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleClick = () => {
        if (showMenu) { setShowMenu(false); return; }
        if (typeof onSelect === "function") onSelect(chat);
    };

    const handleTouchStart = () => { pressTimer.current = setTimeout(() => setShowMenu(true), 500); };
    const handleTouchEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

    const handleDelete = async (e) => {
        if (e) e.stopPropagation();
        setIsDeleting(true);
        try {
            await deleteChatForUser(chat._id);
            setShowDeletePrompt(false);
            setShowMenu(false);
        } catch (err) {
            console.error("Chat delete error:", err);
            setShowDeletePrompt(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleToggleContact = async (e) => {
        e.stopPropagation();
        setContactLoading(true);
        await toggleContact(otherUser?._id);
        setContactLoading(false);
        setShowMenu(false);
    };

    const handleToggleVerify = async (e) => {
        e.stopPropagation();
        try {
            const { data } = await axiosInstance.post(`/admin/verify/${otherUserId}`);
            // Use store action to update verified status instead of direct mutation
            useChatStore.getState().updateChat(chat._id, { 
                participants: chat.participants.map(p => 
                    (p._id?.toString() || p?.toString()) === otherUserId 
                    ? { ...p, isVerified: data.user.isVerified } 
                    : p
                )
            });
            setShowMenu(false);
        } catch (err) {
            console.error(err);
        }
    };

    const menuBtnStyle = {
        background: "transparent", border: "none", padding: "8px 12px",
        cursor: "pointer", width: "100%", textAlign: "left",
        borderRadius: "4px", fontSize: "13px", display: "flex",
        alignItems: "center", gap: "6px",
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <div
                className={`chat-card ${isActive ? "active" : ""} ${hasUnread ? "unread" : ""}`}
                onClick={handleClick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onMouseLeave={() => setShowMenu(false)}
                role="button"
                tabIndex={0}
                style={{ position: "relative" }}
            >
                {/* Avatar */}
                <div className="chat-card-avatar-wrap">
                    <div
                        className={`avatar avatar-md ${hasMoments ? "moments-halo" : ""}`}
                        style={hasMoments ? { "--halo-color": useMomentStore.getState().getHaloColor(otherUserId, user?._id) } : {}}
                    >
                        {otherUser?.avatar
                            ? <img src={otherUser.avatar} alt={otherUser.username} loading="lazy" />
                            : <span>{isDeleted ? "?" : otherUser?.username?.slice(0, 2).toUpperCase()}</span>
                        }
                    </div>
                    {isOnline && <span className="online-dot" />}
                </div>

                {/* Info */}
                <div className="chat-card-info">
                    <div className="chat-card-row">
                            <span
                                className={`chat-card-name ${hasUnread ? "chat-card-name-unread" : ""} ${isContact ? "chat-card-name-contact" : ""}`}
                                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}
                            >
                                {displayName}
                            </span>
                            {otherUser?.isVerified && <span style={{ flexShrink: 0, display: "flex" }}><VerifiedTick /></span>}
                        <span className="chat-card-time">
                            {liveChat.updatedAt ? formatDistanceToNow(new Date(liveChat.updatedAt), { addSuffix: false }) : ""}
                        </span>
                    </div>
                    <div className="chat-card-bottom-row">
                        <span className={`chat-card-preview ${isTyping ? "preview-typing" : ""} ${hasUnread ? "preview-unread" : ""}`}>
                            {preview.text}
                        </span>
                        {hasUnread && !showMenu && (
                            <span className="unread-badge">{displayUnreadCount > 3 ? "3+" : displayUnreadCount}</span>
                        )}
                    </div>
                </div>

                {/* Three-dot menu button */}
                <div className="chat-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                        className="chat-card-menu-btn"
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", marginLeft: "4px", opacity: showMenu ? 1 : 0.45 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
                        </svg>
                    </button>
                </div>

                {/* Context menu */}
                {showMenu && (
                    <div className="chat-card-menu">
                        <button onClick={(e) => { e.stopPropagation(); onPin(); setShowMenu(false); }}
                            style={{ ...menuBtnStyle, color: isPinned ? "var(--color-primary)" : "#94a3b8" }}>
                            <span>📌</span>
                            {isPinned ? "Unpin Chat" : "Pin Chat"}
                        </button>

                        {(user?.role === "co_admin" || user?.role === "master_admin") && !isDeleted && (
                            <button onClick={handleToggleVerify}
                                style={{ ...menuBtnStyle, color: otherUser?.isVerified ? "var(--color-primary)" : "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px", marginBottom: "4px" }}>
                                <VerifiedTick style={{ marginLeft: 0 }} />
                                {otherUser?.isVerified ? "Remove Verification" : "Verify User"}
                            </button>
                        )}

                        {!isDeleted && (
                            <button onClick={handleToggleContact} disabled={contactLoading}
                                style={{ ...menuBtnStyle, color: isContact ? "#f59e0b" : "#94a3b8" }}>
                                <span style={{ fontSize: "14px" }}>{isContact ? "⭐" : "👤"}</span>
                                {contactLoading ? "..." : isContact ? "Remove Contact" : "Tag as Contact"}
                            </button>
                        )}

                        <button onClick={(e) => { e.stopPropagation(); setShowDeletePrompt(true); }}
                            style={{ ...menuBtnStyle, color: "#ef4444", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete Chat
                        </button>
                    </div>
                )}
            </div>

            {/* Delete confirmation portal */}
            {showDeletePrompt && createPortal(
                <div className="modal-overlay moments-aura-overlay" onClick={() => setShowDeletePrompt(false)} style={{ zIndex: 20000 }}>
                    <div className="moments-aura-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "320px", padding: "32px", textAlign: "center" }}>
                        <div style={{ fontSize: "40px", marginBottom: "16px" }}>🗑️</div>
                        <h3 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: "800", marginBottom: "12px" }}>Delete Chat?</h3>
                        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "24px", lineHeight: "1.5" }}>
                            This will remove the entire chat thread for you. This action cannot be undone.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <button className="btn btn-primary" onClick={handleDelete} disabled={isDeleting}
                                style={{ background: "#ef4444", borderColor: "#ef4444" }}>
                                {isDeleting ? "Deleting..." : "Delete Permanently"}
                            </button>
                            <button className="btn btn-outline" onClick={() => setShowDeletePrompt(false)} disabled={isDeleting}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default memo(ChatCard);