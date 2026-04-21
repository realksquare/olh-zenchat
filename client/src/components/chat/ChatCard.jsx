import { useState, useRef, memo, useMemo } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";
import { formatDistanceToNow } from "date-fns";

const ChatCard = ({ chat, isActive, onSelect, onPin, isPinned }) => {
    const { user, toggleContact } = useAuthStore();
    const typingUsers = useChatStore((s) => s.typingUsers);
    const onlineUsers = useChatStore((s) => s.onlineUsers);
    const unreadCount = useChatStore((s) => s.unreadCounts[chat._id] || 0);
    const deleteChatForUser = useChatStore((s) => s.deleteChatForUser);
    const liveChat = useChatStore((s) => s.chats.find((c) => c._id === chat._id)) || chat;

    const [showMenu, setShowMenu] = useState(false);
    const [contactLoading, setContactLoading] = useState(false);
    const pressTimer = useRef(null);

    const otherUser = liveChat.participants?.find((p) => (p._id?.toString() || p.toString()) !== user?._id?.toString());
    const otherUserId = otherUser?._id?.toString() || otherUser?.toString();
    const isTyping = typingUsers[liveChat._id]?.has(otherUserId);
    const isOnline = otherUser?.isOnline || onlineUsers.has(otherUserId);

    // Check if this user is a contact
    const isContact = user?.contacts?.some(
        c => c.userId?.toString() === otherUser?._id?.toString() || c.userId === otherUser?._id
    );

    // Display name: contact name gets label suffix
    const displayName = isContact ? `${otherUser?.username} (Contact)` : otherUser?.username;

    const isLastMessageFromThem =
        liveChat.lastMessage?.senderId !== user?._id &&
        liveChat.lastMessage?.senderId?._id !== user?._id;
    const isLastMessageUnread = isLastMessageFromThem && liveChat.lastMessage?.status !== "read";
    const hasUnread = unreadCount > 0 || isLastMessageUnread;
    const displayUnreadCount = unreadCount > 0 ? unreadCount : (isLastMessageUnread ? 1 : 0);

    const getPreview = () => {
        if (isTyping) return { text: "typing...", isUnread: true };
        if (hasUnread) {
            if (displayUnreadCount === 1 && liveChat.lastMessage?.content) {
                return { text: liveChat.lastMessage.content, isUnread: true };
            }
            if (displayUnreadCount <= 3) {
                return { text: `${displayUnreadCount} new ${displayUnreadCount === 1 ? "message" : "messages"}`, isUnread: true };
            }
            return { text: "3+ new messages", isUnread: true };
        }
        if (!liveChat.lastMessage) return { text: "No messages yet", isUnread: false };
        const { content, type, senderId } = liveChat.lastMessage;
        const isMe = senderId?._id === user?._id || senderId === user?._id;
        if (type === "image") return { text: isMe ? "You sent an image" : "Sent an image", isUnread: false };
        if (type === "video") return { text: isMe ? "You sent a video" : "Sent a video", isUnread: false };
        return { text: isMe ? `You: ${content}` : content, isUnread: false };
    };

    const preview = getPreview();

    const handleClick = () => {
        if (showMenu) { setShowMenu(false); return; }
        if (typeof onSelect === "function") onSelect(chat);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
    };

    const handleTouchStart = () => {
        pressTimer.current = setTimeout(() => setShowMenu(true), 500);
    };

    const handleTouchEnd = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (window.confirm("Delete this chat?")) {
            await deleteChatForUser(chat._id);
        }
        setShowMenu(false);
    };

    const handleToggleContact = async (e) => {
        e.stopPropagation();
        setContactLoading(true);
        await toggleContact(otherUser?._id);
        setContactLoading(false);
        setShowMenu(false);
    };

    const menuBtnStyle = {
        background: "transparent",
        border: "none",
        padding: "8px 12px",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        borderRadius: "4px",
        fontSize: "13px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
    };

    return (
        <div
            className={`chat-card ${isActive ? "active" : ""} ${hasUnread ? "unread" : ""}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
            role="button"
            tabIndex={0}
            onMouseLeave={() => setShowMenu(false)}
            style={{ position: "relative" }}
        >
            <div className="chat-card-avatar-wrap">
                <div className="avatar avatar-md">
                    {otherUser?.avatar ? (
                        <img src={otherUser.avatar} alt={otherUser.username} loading="lazy" />
                    ) : (
                        <span>{otherUser?.username?.slice(0, 2).toUpperCase()}</span>
                    )}
                </div>
                {isOnline && <span className="online-dot" />}
            </div>

            <div className="chat-card-info">
                <div className="chat-card-row">
                    <span className={`chat-card-name ${hasUnread ? "chat-card-name-unread" : ""} ${isContact ? "chat-card-name-contact" : ""}`}>
                        {displayName}
                    </span>
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

            {showMenu && (
                <div className="chat-card-menu">
                    {/* Pin/Unpin */}
                    <button onClick={(e) => { e.stopPropagation(); onPin(); setShowMenu(false); }}
                        style={{ ...menuBtnStyle, color: isPinned ? "var(--color-primary)" : "#94a3b8" }}>
                        <span>📌</span>
                        {isPinned ? "Unpin Chat" : "Pin Chat"}
                    </button>

                    {/* Tag as Contact */}
                    <button onClick={handleToggleContact} disabled={contactLoading}
                        style={{ ...menuBtnStyle, color: isContact ? "#f59e0b" : "#94a3b8" }}>
                        <span>{isContact ? "Starred" : "Verified"}</span>
                        {contactLoading ? "..." : isContact ? "Remove Contact" : "Tag as Contact"}
                    </button>

                    {/* Delete */}
                    <button onClick={handleDelete}
                        style={{ ...menuBtnStyle, color: "#ef4444", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete Chat
                    </button>
                </div>
            )}
        </div>
    );
};

export default memo(ChatCard);