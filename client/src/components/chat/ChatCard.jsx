import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";
import { formatDistanceToNow } from "date-fns";

const ChatCard = ({ chat, isActive, onSelect, onPin, isPinned }) => {
    const { user } = useAuthStore();
    const typingUsers = useChatStore((s) => s.typingUsers);
    const onlineUsers = useChatStore((s) => s.onlineUsers);
    const unreadCount = useChatStore((s) => s.unreadCounts[chat._id] || 0);
    const liveChat = useChatStore((s) => s.chats.find((c) => c._id === chat._id)) || chat;

    const otherUser = liveChat.participants?.find((p) => p._id !== user?._id);
    const isTyping = typingUsers[liveChat._id]?.has(otherUser?._id);
    const isOnline = otherUser?.isOnline || onlineUsers.has(otherUser?._id);

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
        if (typeof onSelect === "function") onSelect(chat);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
    };

    return (
        <div
            className={`chat-card ${isActive ? "active" : ""} ${hasUnread ? "unread" : ""}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
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
                    {hasUnread && (
                        <span className="unread-badge">
                            {displayUnreadCount > 3 ? "3+" : displayUnreadCount}
                        </span>
                    )}
                </div>
            </div>

            {onPin && (
                <button
                    className={`chat-card-pin ${isPinned ? "pinned" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onPin(); }}
                    aria-label={isPinned ? "Unpin chat" : "Pin chat"}
                    title={isPinned ? "Unpin" : "Pin"}
                >
                    📌
                </button>
            )}
        </div>
    );
};

export default ChatCard;