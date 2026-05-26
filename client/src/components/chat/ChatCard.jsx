import { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";
import { useMomentStore } from "../../stores/momentStore";
import { formatDistanceToNow } from "date-fns";
import { VerifiedTick } from "../ui/Icons";
import axiosInstance from "../../utils/axios";

const ChatCard = ({ chat, isActive, onSelect, onPin, isPinned }) => {
    // ── Store subscriptions ───────────────────────────────────────────────────
    const user = useAuthStore((s) => s.user);
    const toggleContact = useAuthStore((s) => s.toggleContact);
    const typingUsers = useChatStore((s) => s.typingUsers);
    const onlineUsers = useChatStore((s) => s.onlineUsers);
    const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);
    const peerLowBandwidth = useChatStore((s) => s.peerLowBandwidth);
    const isOffline = useChatStore((s) => s.isOffline);
    const unreadCount = useChatStore((s) => s.unreadCounts[chat._id] || 0);
    const deleteChatForUser = useChatStore((s) => s.deleteChatForUser);
    const liveChat = useChatStore((s) => s.chats.find((c) => c._id === chat._id)) || chat;
    const hasActiveMoment = useMomentStore((s) => s.hasActiveMoment);

    // ── Local state & refs ────────────────────────────────────────────────────
    const [showUserCard, setShowUserCard] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [contactLoading, setContactLoading] = useState(false);
    const [showDeletePrompt, setShowDeletePrompt] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [marqueeDist, setMarqueeDist] = useState(0);
    const nameContainerRef = useRef(null);
    const nameContentRef = useRef(null);
    const pressTimer = useRef(null);

    const [isMobile, setIsMobile] = useState(false);
    const menuTimeoutRef = useRef(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => {
            window.removeEventListener("resize", checkMobile);
            if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
        };
    }, []);

    const handleMouseEnter = () => {
        if (menuTimeoutRef.current) {
            clearTimeout(menuTimeoutRef.current);
            menuTimeoutRef.current = null;
        }
    };

    const handleMouseLeave = () => {
        if (!isMobile && showMenu) {
            menuTimeoutRef.current = setTimeout(() => {
                setShowMenu(false);
            }, 1000);
        }
    };

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
    const iBlocked = liveChat.blockStatus?.iBlocked;
    const theyBlocked = liveChat.blockStatus?.theyBlocked;
    const isBlocked = iBlocked || theyBlocked;
    const isOnline = !isBlocked && !isOffline && (otherUser?.isOnline || (otherUserId && onlineUsers.has(otherUserId.toString())));
    const isSPOp = isOnline && peerLowBandwidth[otherUserId] === true;
    const hasMoments = !isBlocked && !!(otherUserId && hasActiveMoment(otherUserId.toString()));
    const isContact = !!(user?.contacts?.some(c => {
        const uid = c.userId?._id?.toString() || c.userId?.toString();
        return uid === otherUserId;
    }));
    const displayName = isDeleted ? "(user_deleted)" : (otherUser?.username ?? "");

    // ── Marquee: measure overflow after paint ─────────────────────────────────
    useEffect(() => {
        if (!nameContainerRef.current || !nameContentRef.current) return;
        const containerWidth = nameContainerRef.current.offsetWidth;
        const contentWidth = nameContentRef.current.scrollWidth;
        setMarqueeDist(contentWidth > containerWidth ? -(contentWidth - containerWidth + 10) : 0);
    }, [displayName, liveChat.isGroup]);

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
        if (iBlocked) return { text: "You blocked this user", isUnread: false };
        if (theyBlocked) return { text: "This user blocked you", isUnread: false };
        if (isTyping) {
            if (isSPOp) {
                return { 
                    text: (
                        <div className="typing-indicator" style={{ display: 'inline-flex', padding: 0, margin: 0, background: 'transparent' }}>
                            <div className="typing-dot" style={{ width: '4px', height: '4px', background: 'var(--color-primary)' }}></div>
                            <div className="typing-dot" style={{ width: '4px', height: '4px', background: 'var(--color-primary)' }}></div>
                            <div className="typing-dot" style={{ width: '4px', height: '4px', background: 'var(--color-primary)' }}></div>
                        </div>
                    ),
                    isUnread: true 
                };
            }
            return { text: typeof typingScramble === "string" ? typingScramble : "typing...", isUnread: true };
        }
        if (hasUnread) {
            const lm = liveChat.lastMessage;
            if (displayUnreadCount === 1 && lm?.type === "gif") return { text: "Sent a GIF", isUnread: true };
            if (displayUnreadCount === 1 && lm?.type === "sticker") return { text: "Sent a sticker", isUnread: true };
            if (displayUnreadCount === 1 && lm?.type === "image") return { text: "Sent an image", isUnread: true };
            if (displayUnreadCount === 1 && lm?.type === "video") return { text: "Sent a video", isUnread: true };
            if (displayUnreadCount === 1 && lm?.type === "voice") return { text: "Sent a voice message", isUnread: true };
            if (displayUnreadCount === 1 && lm?.type === "file") return { text: "Sent a file", isUnread: true };
            if (displayUnreadCount === 1 && lm?.content)
                return { text: lm.content, isUnread: true };
            if (displayUnreadCount <= 3)
                return { text: `${displayUnreadCount} new ${displayUnreadCount === 1 ? "message" : "messages"}`, isUnread: true };
            return { text: "3+ new messages", isUnread: true };
        }
        const effectiveLastMsg = liveChat.lastMessage || (() => {
            const chatMessages = useChatStore.getState().messages[chat._id] || [];
            const visible = chatMessages
                .filter(m => !m.deletedForEveryone && m.status !== "sending")
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return visible[0] || null;
        })();
        if (!effectiveLastMsg) return { text: "No messages yet", isUnread: false };
        
        if (effectiveLastMsg.deletedForEveryone || effectiveLastMsg.deletedFor?.some(id => id === user?._id || id?.toString() === user?._id)) {
            return { text: "This message was deleted", isUnread: false };
        }
        const messageAgeMs = Date.now() - new Date(effectiveLastMsg.createdAt).getTime();
        const isGhostDeleted = !effectiveLastMsg.content && !effectiveLastMsg.mediaUrl && !effectiveLastMsg.music && effectiveLastMsg.type === "text" && !effectiveLastMsg.deletedForEveryone && messageAgeMs > 15000;
        if (isGhostDeleted) {
            return { text: "This message was deleted", isUnread: false };
        }

        const { content, type, senderId } = effectiveLastMsg;
        const isMe = senderId?._id === user?._id || senderId === user?._id;
        if (type === "image") return { text: isMe ? "You sent an image" : "Sent an image", isUnread: false };
        if (type === "video") return { text: isMe ? "You sent a video" : "Sent a video", isUnread: false };
        if (type === "gif") return { text: isMe ? "You sent a GIF" : "Sent a GIF", isUnread: false };
        if (type === "sticker") return { text: isMe ? "You sent a sticker" : "Sent a sticker", isUnread: false };
        if (type === "voice") return { text: isMe ? "You sent a voice message" : "Sent a voice message", isUnread: false };
        if (type === "file") return { text: isMe ? "You sent a file" : "Sent a file", isUnread: false };
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
        if (e) e.stopPropagation();
        setContactLoading(true);
        await toggleContact(otherUser?._id);
        setContactLoading(false);
        setShowMenu(false);
    };

    const handleToggleVerify = async (e) => {
        if (e) e.stopPropagation();
        try {
            const { data } = await axiosInstance.post(`/admin/verify/${otherUserId}`);
            if (otherUser) otherUser.isVerified = data.user.isVerified;
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
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                role="button"
                tabIndex={0}
                style={{ position: "relative", opacity: isBlocked ? 0.65 : 1 }}
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
                    {isOnline && <span className={`online-dot${isSPOp ? ' online-dot--amber' : ''}`} />}
                </div>

                {/* Info */}
                <div className="chat-card-info">
                    <div className="chat-card-row">
                        <div
                            className={`chat-card-name ${hasUnread ? "chat-card-name-unread" : ""} ${isContact ? "chat-card-name-contact" : ""}`}
                            style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", flex: 1, minWidth: 0 }}
                        >
                            <div className="marquee-container" ref={nameContainerRef}>
                                <span
                                    ref={nameContentRef}
                                    className={`marquee-content ${marqueeDist < 0 ? "marquee-active" : ""}`}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        ...(marqueeDist < 0 ? { "--marquee-dist": `${marqueeDist}px` } : {})
                                    }}
                                >
                                    <span>{displayName}</span>
                                    {isBlocked && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', color: '#ef4444', marginLeft: '4px' }} title={iBlocked ? 'You blocked this user' : 'This user blocked you'}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                            </svg>
                                        </span>
                                    )}
                                    {otherUser?.isVerified && (
                                        <span style={{ flexShrink: 0, display: "flex" }}>
                                            <VerifiedTick />
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>
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

                {/* Context menu - Desktop Only */}
                {!isMobile && showMenu && (
                    <div className="chat-card-menu" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); onPin(); setShowMenu(false); }}
                            style={{ ...menuBtnStyle, color: isPinned ? "var(--color-primary)" : "#94a3b8" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.33-2.91A1 1 0 0 1 16 10.5V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v5.5a1 1 0 0 1-.23.59l-2.33 2.91a2 2 0 0 0-.44 1.24Z" />
                            </svg>
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
                                {isContact ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                                )}
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

            {/* Context menu - Mobile Bottom Sheet Portal */}
            {isMobile && showMenu && createPortal(
                <div className="mobile-bottom-sheet-overlay" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}>
                    <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="mobile-bottom-sheet-handle" />
                        <div className="mobile-bottom-sheet-header">
                            <h3>Chat Options</h3>
                        </div>
                        <div className="mobile-bottom-sheet-content">
                            <button onClick={(e) => { e.stopPropagation(); onPin(); setShowMenu(false); }}
                                style={{ ...menuBtnStyle, color: isPinned ? "var(--color-primary)" : "#94a3b8" }}
                                className="bottom-sheet-item"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.33-2.91A1 1 0 0 1 16 10.5V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v5.5a1 1 0 0 1-.23.59l-2.33 2.91a2 2 0 0 0-.44 1.24Z" />
                                </svg>
                                {isPinned ? "Unpin Chat" : "Pin Chat"}
                            </button>

                            {(user?.role === "co_admin" || user?.role === "master_admin") && !isDeleted && (
                                <button onClick={(e) => { e.stopPropagation(); handleToggleVerify(e); }}
                                    style={{ ...menuBtnStyle, color: otherUser?.isVerified ? "var(--color-primary)" : "#94a3b8" }}
                                    className="bottom-sheet-item"
                                >
                                    <VerifiedTick style={{ marginLeft: 0, width: 18, height: 18 }} />
                                    {otherUser?.isVerified ? "Remove Verification" : "Verify User"}
                                </button>
                            )}

                            {!isDeleted && (
                                <button onClick={(e) => { e.stopPropagation(); handleToggleContact(e); }} disabled={contactLoading}
                                    style={{ ...menuBtnStyle, color: isContact ? "#f59e0b" : "#94a3b8" }}
                                    className="bottom-sheet-item"
                                >
                                    {isContact ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                                    )}
                                    {contactLoading ? "..." : isContact ? "Remove Contact" : "Tag as Contact"}
                                </button>
                            )}

                            <button onClick={(e) => { e.stopPropagation(); setShowDeletePrompt(true); setShowMenu(false); }}
                                style={{ ...menuBtnStyle, color: "#ef4444" }}
                                className="bottom-sheet-item danger-item"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Delete Chat
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete confirmation portal */}
            {showDeletePrompt && createPortal(
                <div className="modal-overlay moments-aura-overlay" onClick={() => setShowDeletePrompt(false)} style={{ zIndex: 20000 }}>
                    <div className="moments-aura-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "320px", padding: "32px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "#ef4444" }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                        </div>
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