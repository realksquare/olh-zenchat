import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";

const MessageBubble = ({ message, isMe, showAvatar, otherUser, onEdit, onDelete }) => {
    const [mobileDropdown, setMobileDropdown] = useState(false);
    const { user } = useAuthStore();
    const status = message?.status ?? "sent";
    const outerRef = useRef(null);

    const isWithinEditWindow = isMe &&
        (Date.now() - new Date(message.createdAt).getTime() < 10 * 60 * 1000);

    const isDeletedForMe = message.deletedFor?.some(
        (id) => id === user?._id || id?.toString() === user?._id
    );

    useEffect(() => {
        if (!mobileDropdown) return;
        const handleOutside = (e) => {
            if (outerRef.current && !outerRef.current.contains(e.target)) {
                setMobileDropdown(false);
            }
        };
        document.addEventListener("touchstart", handleOutside);
        return () => document.removeEventListener("touchstart", handleOutside);
    }, [mobileDropdown]);

    if (message.deletedForEveryone) {
        return (
            <div className={`message-row ${isMe ? "mine" : "theirs"}`}>
                {!isMe && showAvatar && (
                    <div className="avatar avatar-sm">
                        {otherUser?.avatar ? (
                            <img src={otherUser.avatar} alt={otherUser.username} loading="lazy" />
                        ) : (
                            <span>{otherUser?.username?.slice(0, 2).toUpperCase()}</span>
                        )}
                    </div>
                )}
                {!isMe && !showAvatar && <div className="avatar-spacer" />}
                <div className="message-bubble deleted-bubble">
                    <span className="deleted-text">🚫 This message was deleted</span>
                </div>
            </div>
        );
    }

    if (isDeletedForMe) return null;

    return (
        <div className={`message-row ${isMe ? "mine" : "theirs"}`}>
            {!isMe && showAvatar && (
                <div className="avatar avatar-sm">
                    {otherUser?.avatar ? (
                        <img src={otherUser.avatar} alt={otherUser.username} loading="lazy" />
                    ) : (
                        <span>{otherUser?.username?.slice(0, 2).toUpperCase()}</span>
                    )}
                </div>
            )}
            {!isMe && !showAvatar && <div className="avatar-spacer" />}

            <div className="message-bubble-outer" ref={outerRef}>
                <div
                    className={`message-bubble ${isMe ? `mine status-${status}` : "theirs"}`}
                    onClick={() => {
                        if (isMe && !window.matchMedia("(hover: hover)").matches) {
                            setMobileDropdown((p) => !p);
                        }
                    }}
                >
                    <span className="message-text">{message.content}</span>
                    <div className="message-meta">
                        {message.isEdited && <span className="message-edited-label">(edited)</span>}
                        <span className="message-time">
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </div>
                </div>

                {isMe && (
                    <div className={`message-dropdown ${mobileDropdown ? "mobile-visible" : ""}`}>
                        {isWithinEditWindow && (
                            <button
                                className="message-dropdown-item"
                                onMouseDown={(e) => { e.preventDefault(); setMobileDropdown(false); onEdit(message); }}
                            >
                                ✏️ Edit
                            </button>
                        )}
                        <button
                            className="message-dropdown-item delete"
                            onMouseDown={(e) => { e.preventDefault(); setMobileDropdown(false); onDelete(message); }}
                        >
                            🗑️ Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageBubble;