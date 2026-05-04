import { useState, useRef, useEffect, memo, useMemo } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import DecryptedText from "./DecryptedText";

const MessageBubble = ({ message, isMe, showAvatar, otherUser, onEdit, onDelete }) => {
    const [mobileDropdown, setMobileDropdown] = useState(false);
    const { user } = useAuthStore();
    const { toggleStarMessage, markViewOnceAsViewed, messages } = useChatStore();
    const status = message?.status ?? "sent";
    const progress = message?.progress ?? 0;
    const outerRef = useRef(null);

    const repliedToMessage = useMemo(() => {
        if (!message.replyTo) return null;
        if (typeof message.replyTo === 'object' && message.replyTo._id) return message.replyTo;
        return messages[message.chatId]?.find(m => m._id === message.replyTo);
    }, [message.replyTo, messages, message.chatId]);

    const scrollToMessage = (msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("message-highlight");
            setTimeout(() => el.classList.remove("message-highlight"), 2000);
        }
    };

    const isWithinEditWindow = isMe &&
        (Date.now() - new Date(message.createdAt).getTime() < 10 * 60 * 1000);

    const isDeletedForMe = message.deletedFor?.some(
        (id) => id === user?._id || id?.toString() === user?._id
    );

    const isNew = useMemo(() => {
        const diff = Date.now() - new Date(message.createdAt).getTime();
        return diff < 1500;
    }, [message.createdAt]);

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

    // Fallback: treat messages with no content/media as deleted for everyone
    // BUT only if older than 5 seconds — prevents false-positives on in-transit optimistic messages
    const messageAgeMs = Date.now() - new Date(message.createdAt).getTime();
    const isGhostDeleted = !message.content && !message.mediaUrl && !message.music && message.type === "text" && !message.deletedForEveryone && messageAgeMs > 15000;

    if (message.deletedForEveryone || isGhostDeleted) {
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
                    <span className="deleted-text">This message was deleted</span>
                </div>
            </div>
        );
    }

    if (isDeletedForMe) return null;

    const isViewOnce = message.isViewOnce;
    const isViewedByMe = message.viewedBy?.includes(user?._id);
    const isViewedByAnyone = message.viewedBy?.length > 0;

    return (
        <div 
            id={`msg-${message._id}`}
            className={`message-row ${isMe ? "mine" : "theirs"} ${isNew ? "message-slide-up" : ""}`}
            onDoubleClick={() => !message.deletedForEveryone && onEdit({ action: "reply", ...message })}
        >
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
                    className={`message-bubble ${isMe ? `mine status-${status === "read" ? "seen" : status}` : "theirs"} ${isViewOnce ? "view-once" : ""}`}
                    onClick={() => {
                        if (!window.matchMedia("(hover: hover)").matches) {
                            setMobileDropdown((p) => !p);
                        }
                    }}
                >
                    {isViewOnce && isMe ? (
                        <div className="view-once-placeholder viewed">
                            <span>Media sent</span>
                        </div>
                    ) : isViewOnce && !isMe && (isViewedByMe || isViewedByAnyone || !message.mediaUrl) && !tempVisible ? (
                        <div className="view-once-placeholder viewed">
                            <span>Media viewed</span>
                        </div>
                    ) : isViewOnce && !isMe && !tempVisible ? (
                        <div className="view-once-placeholder" onClick={handleViewOnce}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>View once media</span>
                        </div>
                    ) : (
                        <>
                            {message.replyTo && (
                                <div 
                                    className="replied-message-preview" 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        const targetId = message.replyTo?._id || message.replyTo;
                                        scrollToMessage(targetId); 
                                    }}
                                >
                                    {repliedToMessage ? (
                                        <>
                                            <div className="replied-sender">
                                                {repliedToMessage.senderId?._id === user?._id || repliedToMessage.senderId === user?._id ? "You" : (repliedToMessage.senderId?.username || otherUser?.username || "Someone")}
                                            </div>
                                            <div className="replied-content">
                                                {repliedToMessage.content || (repliedToMessage.type === 'image' ? "📷 Image" : (repliedToMessage.type === 'video' ? "🎥 Video" : "Media"))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="replied-content" style={{ opacity: 0.6, fontStyle: 'italic', fontSize: '0.8rem' }}>
                                            Original message deleted
                                        </div>
                                    )}
                                </div>
                            )}
                            {(message.type === "image" || message.type === "video") && message.mediaUrl && !isViewOnce && (
                                <div className="message-media-wrap">
                                    {message.type === "image" ? (
                                        <img src={getThumbnailUrl(message.mediaUrl)} alt="Sent image" className="message-image" loading="lazy" />
                                    ) : (
                                        <video src={message.mediaUrl} controls className="message-video" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                    )}
                                </div>
                            )}
                            {message.content && (
                                <span className="message-text">
                                    <DecryptedText 
                                        text={message.content} 
                                        animate={isNew && !isMe && message.canSeeScramble} 
                                    />
                                </span>
                            )}
                            {status === "sending" && (
                                <div className="message-progress-container">
                                    <div className="message-progress-bar" style={{ width: `${progress}%` }}></div>
                                    <span className="progress-text">{progress}%</span>
                                </div>
                            )}
                        </>
                    )}
                    
                    <div className="message-meta">
                        {message.starredBy?.includes(user?._id) && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" style={{ marginRight: '2px' }}>
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                        )}
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span>{message.starredBy?.includes(user?._id) ? "Unfav" : "Fav"}</span>
                    </button>
                    <button
                        className="message-dropdown-item"
                        onMouseDown={(e) => { e.preventDefault(); setMobileDropdown(false); onEdit({ action: "reply", ...message }); }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                            <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                        </svg>
                        <span>Reply</span>
                    </button>
                    {isMe && (
                        <>
                            {isWithinEditWindow && (
                                <button
                                    className="message-dropdown-item"
                                    onMouseDown={(e) => { e.preventDefault(); setMobileDropdown(false); onEdit(message); }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    Edit
                                </button>
                            )}
                            <button
                                className="message-dropdown-item delete"
                                onMouseDown={(e) => { e.preventDefault(); setMobileDropdown(false); onDelete(message); }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                                <span>Delete</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(MessageBubble);