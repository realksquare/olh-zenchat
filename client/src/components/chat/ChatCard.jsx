import { useState, useRef } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";
import { formatDistanceToNow } from "date-fns";

const ChatCard = ({ chat, isActive, onSelect, onPin, isPinned }) => {
    const { user } = useAuthStore();
    const typingUsers = useChatStore((s) => s.typingUsers);
    const onlineUsers = useChatStore((s) => s.onlineUsers);
    const unreadCount = useChatStore((s) => s.unreadCounts[chat._id] || 0);
    const deleteChatForUser = useChatStore((s) => s.deleteChatForUser);
    const liveChat = useChatStore((s) => s.chats.find((c) => c._id === chat._id)) || chat;

    const [showMenu, setShowMenu] = useState(false);
    const pressTimer = useRef(null);

    const otherUser = liveChat.participants?.find((p) => p._id !== user?._id);
    const isTyping = typingUsers[liveChat._id]?.has(otherUser?._id) || typingUsers[liveChat._id]?.has(otherUser?._id?.toString());
    const isOnline = otherUser?.isOnline || onlineUsers.has(otherUser?._id) || onlineUsers.has(otherUser?._id?.toString());

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
                const word = displayUnreadCount === 1 ? "message" : "messages";
                return { text: `${displayUnreadCount} new ${word}`, isUnread: true };
            }
            return { text: "3+ new messages", isUnread: true };
        }

        if (!liveChat.lastMessage) return { text: "No messages yet", isUnread: false };
        const { content, type, senderId } = liveChat.lastMessage;
        const isMe = senderId?._id === user?._id || senderId === user?._id;
        if (type === "image") return { text: isMe ? "You sent an image 📷" : "Sent an image 📷", isUnread: false };
        return { text: isMe ? `You: ${content}` : content, isUnread: false };
    };

    const preview = getPreview();

    const handleClick = () => {
        if (showMenu) {
            setShowMenu(false);
            return;
        }
        if (typeof onSelect === "function") onSelect(chat);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
    };

    const handleTouchStart = () => {
        pressTimer.current = setTimeout(() => {
            setShowMenu(true);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this chat?")) {
            await deleteChatForUser(chat._id);
        }
        setShowMenu(false);
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
                    <span className={`chat-card-name ${hasUnread ? "chat-card-name-unread" : ""}`}>
                        {otherUser?.username}
                    </span>
                    <span className="chat-card-time">
                        {liveChat.updatedAt
                            ? formatDistanceToNow(new Date(liveChat.updatedAt), { addSuffix: false })
                            : ""}
                    </span>
                </div>
                <div className="chat-card-bottom-row">
                    <span className={`chat-card-preview ${preview.isTyping ? "preview-typing" : ""} ${hasUnread ? "preview-unread" : ""}`}>
                        {preview.text}
                    </span>
                    {hasUnread && !showMenu && (
                        <span className="unread-badge">
                            {displayUnreadCount > 3 ? "3+" : displayUnreadCount}
                        </span>
                    )}
                </div>
            </div>

            <div className="chat-card-actions" onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center" }}>
                {onPin && !showMenu && (
                    <button
                        className={`chat-card-pin ${isPinned ? "pinned" : ""}`}
                        onClick={(e) => { e.stopPropagation(); onPin(); }}
                        aria-label={isPinned ? "Unpin chat" : "Pin chat"}
                        title={isPinned ? "Unpin" : "Pin"}
                    >
                        📌
                    </button>
                )}
                
                <button 
                    className="chat-card-menu-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                    }}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        marginLeft: "4px",
                        opacity: showMenu ? 1 : 0.4
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>
            </div>

            {showMenu && (
                <div 
                    className="chat-card-menu"
                    style={{
                        position: "absolute",
                        right: "10px",
                        top: "40px",
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "4px",
                        zIndex: 10,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                    }}
                >
                    <button 
                        onClick={handleDelete}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            padding: "8px 12px",
                            cursor: "pointer",
                            width: "100%",
                            textAlign: "left",
                            borderRadius: "4px",
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete Chat
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChatCard;