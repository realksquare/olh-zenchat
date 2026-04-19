import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";

const MessageBubble = ({ message, isMe, showAvatar, otherUser, onEdit, onDelete }) => {
    const [mobileDropdown, setMobileDropdown] = useState(false);
    const { user } = useAuthStore();
    const { toggleStarMessage, markViewOnceAsViewed } = useChatStore();
    const status = message?.status ?? "sent";
    const outerRef = useRef(null);

    const isWithinEditWindow = isMe &&
        (Date.now() - new Date(message.createdAt).getTime() < 10 * 60 * 1000);

    const isDeletedForMe = message.deletedFor?.some(
        (id) => id === user?._id || id?.toString() === user?._id
    );

    const [tempVisible, setTempVisible] = useState(false);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "hidden") {
                setTempVisible(false);
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

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

    const getThumbnailUrl = (url) => {
        if (!url || !url.includes("cloudinary.com")) return url;
        return url.replace("/upload/", "/upload/c_limit,w_1000,q_auto,f_auto/");
    };

    const handleViewOnce = () => {
        if (!tempVisible) {
            setTempVisible(true);
            markViewOnceAsViewed(message._id, message.chatId);
        }
    };

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

    const isViewOnce = message.isViewOnce;
    const isViewedByMe = message.viewedBy?.includes(user?._id);
    const isViewedByAnyone = message.viewedBy?.length > 0;

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
                    className={`message-bubble ${isMe ? `mine status-${status}` : "theirs"} ${isViewOnce ? "view-once" : ""}`}
                    onClick={() => {
                        if (!isMe && !window.matchMedia("(hover: hover)").matches) {
                            setMobileDropdown((p) => !p);
                        }
                    }}
                >
                    {isViewOnce && !isMe && !isViewedByMe && !tempVisible ? (
                        <div className="view-once-placeholder" onClick={handleViewOnce}>
                            <span>👁️ View once media</span>
                        </div>
                    ) : isViewOnce && !isMe && (isViewedByMe || isViewedByAnyone) && !tempVisible ? (
                        <div className="view-once-placeholder viewed">
                            <span>🚫 Media viewed</span>
                        </div>
                    ) : (
                        <>
                            {(message.type === "image" || message.type === "video") && message.mediaUrl && (
                                <div className="message-media-wrap">
                                    {message.type === "image" ? (
                                        <img src={getThumbnailUrl(message.mediaUrl)} alt="Sent image" className="message-image" loading="lazy" />
                                    ) : (
                                        <video src={message.mediaUrl} controls className="message-video" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                    )}
                                </div>
                            )}
                            {message.content && <span className="message-text">{message.content}</span>}
                        </>
                    )}
                    
                    <div className="message-meta">
                        {message.starredBy?.includes(user?._id) && <span className="starred-icon">⭐</span>}
                        {message.isEdited && <span className="message-edited-label">(edited)</span>}
                        <span className="message-time">
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </div>
                </div>

                <div className={`message-dropdown ${mobileDropdown ? "mobile-visible" : ""} ${!isMe ? "theirs-dropdown" : ""}`}>
                    <button
                        className="message-dropdown-item"
                        onMouseDown={(e) => { e.preventDefault(); setMobileDropdown(false); toggleStarMessage(message._id, message.chatId); }}
                    >
                        {message.starredBy?.includes(user?._id) ? "❌ Remove Fav" : "⭐ Fav"}
                    </button>
                    {isMe && isWithinEditWindow && (
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
            </div>
        </div>
    );
};

export default MessageBubble;