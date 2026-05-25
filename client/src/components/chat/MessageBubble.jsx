import { useState, useRef, useEffect, memo, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { useSocket } from "../../context/SocketContext";
import DecryptedText from "./DecryptedText";

const HeartReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-heart" style={{ filter: "drop-shadow(0 2px 6px rgba(239, 68, 68, 0.45))" }}>
        <defs>
            <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff5a79" />
                <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
        </defs>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="url(#heartGrad)" stroke="#ffffff" strokeWidth="1.8" />
    </svg>
);

const ThumbsUpReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-thumbsup" style={{ filter: "drop-shadow(0 2px 6px rgba(245, 158, 11, 0.45))" }}>
        <defs>
            <linearGradient id="thumbsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
        </defs>
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3l3.15-6.3a2.12 2.12 0 0 1 4.05 1.18z" fill="url(#thumbsGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <path d="M7 10v12" stroke="#ffffff" strokeWidth="1.8" />
    </svg>
);

const LaughingReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-laughing" style={{ filter: "drop-shadow(0 2px 6px rgba(234, 179, 8, 0.45))" }}>
        <defs>
            <linearGradient id="laughGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#laughGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <path d="M8 9.5 9.5 11 8 12.5" stroke="#1e293b" strokeWidth="2" />
        <path d="M16 9.5 14.5 11 16 12.5" stroke="#1e293b" strokeWidth="2" />
        <path d="M9 15a3 3 0 0 0 6 0H9z" fill="#1e293b" stroke="none" />
        <g className="r-tear-drop" style={{ transformOrigin: 'center' }}>
            <path d="M6 11c-.3.5-.5 1-.5 1.4a1 1 0 0 0 2 0c0-.4-.2-.9-.5-1.4a.1.1 0 0 0-.2 0z" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.8" />
            <path d="M18 11c-.3.5-.5 1-.5 1.4a1 1 0 0 0 2 0c0-.4-.2-.9-.5-1.4a.1.1 0 0 0-.2 0z" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.8" />
        </g>
    </svg>
);

const SadReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-sad" style={{ filter: "drop-shadow(0 2px 6px rgba(14, 165, 233, 0.45))" }}>
        <defs>
            <linearGradient id="sadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#sadGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <line x1="9" y1="9" x2="9" y2="11" stroke="#1e293b" strokeWidth="2" />
        <line x1="15" y1="9" x2="15" y2="11" stroke="#1e293b" strokeWidth="2" />
        <path d="M16 17a4 4 0 0 0-8 0" stroke="#1e293b" strokeWidth="2" />
        <path d="M9.2 11.5c.2.8-.2 1.5-.7 1.5s-.7-.7-.7-1.5.5-1.5.7-1.5.5.7.7 1.5z" fill="#3b82f6" stroke="none" />
    </svg>
);

const AngryReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-angry" style={{ filter: "drop-shadow(0 2px 6px rgba(244, 63, 94, 0.45))" }}>
        <defs>
            <linearGradient id="angryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#angryGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <path d="m8 9 2.5 1" stroke="#ffffff" strokeWidth="2" />
        <path d="m16 9-2.5 1" stroke="#ffffff" strokeWidth="2" />
        <circle cx="9" cy="12" r="1" fill="#ffffff" stroke="none" />
        <circle cx="15" cy="12" r="1" fill="#ffffff" stroke="none" />
        <path d="M14 16.5a2 2 0 0 0-4 0" stroke="#ffffff" strokeWidth="2" />
    </svg>
);

const HifiReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-hifi" style={{ filter: "drop-shadow(0 2px 6px rgba(167, 139, 250, 0.45))" }}>
        <defs>
            <linearGradient id="hifiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
        </defs>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" fill="url(#hifiGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5 5 3Z" fill="#ffffff" stroke="none" opacity="0.8" />
        <path d="m19 15 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" fill="#ffffff" stroke="none" opacity="0.8" />
    </svg>
);

const REACTIONS_MAP = {
    heart: HeartReaction,
    thumbsup: ThumbsUpReaction,
    laughing: LaughingReaction,
    sad: SadReaction,
    angry: AngryReaction,
    hifi: HifiReaction
};

const MessageBubble = ({ message, isMe, showAvatar, otherUser, onEdit, onDelete, onMediaClick, canDelete = true, canReply = true, zenFadeClass = "" }) => {
    const user = useAuthStore((s) => s.user);
    const { toggleStarMessage, markViewOnceAsViewed } = useChatStore.getState();
    const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);
    const isZenMode = useChatStore((s) => s.isZenMode);
    
    const [mobileDropdown, setMobileDropdown] = useState(false);
    const { reactToMessage } = useSocket();
    const [showReactionsPill, setShowReactionsPill] = useState(false);
    const [reactionsSheetOpen, setReactionsSheetOpen] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [isMediaLoaded, setIsMediaLoaded] = useState(false);
    const [manualLoad, setManualLoad] = useState(false);
    
    const reactionsTimeoutRef = useRef(null);
    const lastTapRef = useRef(0);
    const tapTimeoutRef = useRef(null);
    const imgRef = useRef(null);
    const outerRef = useRef(null);

    // Sync body class to lock text selection while reactions sheet is open
    useEffect(() => {
        if (reactionsSheetOpen) {
            document.body.classList.add('reactions-sheet-open');
            window.getSelection()?.removeAllRanges();
        } else {
            document.body.classList.remove('reactions-sheet-open');
        }
        return () => document.body.classList.remove('reactions-sheet-open');
    }, [reactionsSheetOpen]);

    // Touch gesture state tracking
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
    const longPressTimerRef = useRef(null);
    const preventClickRef = useRef(false);

    const isMobile = window.innerWidth <= 768;
    const shouldDelayLoad = isLowBandwidth && !isMe && !manualLoad;
    const status = message?.status ?? "sent";
    const progress = message?.progress ?? 0;
    const isViewOnce = message.isViewOnce;
    const isMediaMsg = (message.type === "image" || message.type === "video") && message.mediaUrl;
    const needsLoading = isMediaMsg && !isViewOnce && !shouldDelayLoad && status !== "sending";
    const isShown = !needsLoading || isMediaLoaded;

    const handleMouseEnter = () => {
        if (isMobile) return;
        if (reactionsTimeoutRef.current) {
            clearTimeout(reactionsTimeoutRef.current);
            reactionsTimeoutRef.current = null;
        }
        setShowReactionsPill(true);
    };

    const handleMouseLeave = () => {
        if (isMobile) return;
        setShowReactionsPill(false);
    };

    const handleTouchStart = (e) => {
        if (!isMobile) return;
        
        if (e.target.closest('a') || e.target.closest('button')) {
            return;
        }

        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
        preventClickRef.current = false;

        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
        }

        longPressTimerRef.current = setTimeout(() => {
            // If the user has active text selection, do not trigger the reaction sheet
            const selectedText = window.getSelection()?.toString();
            if (selectedText && selectedText.length > 0) {
                return;
            }
            // Clear any stray text selection that may have formed during the hold
            window.getSelection()?.removeAllRanges();
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            setReactionsSheetOpen(true);
            preventClickRef.current = true;
        }, 500);
    };

    const handleTouchMove = (e) => {
        if (!isMobile) return;
        const touch = e.touches[0];
        const diffX = Math.abs(touch.clientX - touchStartRef.current.x);
        const diffY = Math.abs(touch.clientY - touchStartRef.current.y);
        
        if (diffX > 15 || diffY > 15) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }
    };

    const handleTouchEnd = (e) => {
        if (!isMobile) return;
        
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (preventClickRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const touchDuration = Date.now() - touchStartRef.current.time;
        if (touchDuration < 300) {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
                if (tapTimeoutRef.current) {
                    clearTimeout(tapTimeoutRef.current);
                    tapTimeoutRef.current = null;
                }
                e.preventDefault();
                e.stopPropagation();
                setMobileDropdown(true);
            } else {
                lastTapRef.current = now;
            }
        }
    };

    const handleTouchCancel = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleReact = (emojiKey) => {
        reactToMessage(message.chatId, message._id, emojiKey);
        setShowReactionsPill(false);
        setReactionsSheetOpen(false);
    };

    const handleBubbleClick = (e) => {
        if (isMobile) return;
        if (e.target.closest('.replied-message-preview') || 
            e.target.closest('.message-media-wrap') || 
            e.target.closest('.view-once-placeholder') ||
            e.target.closest('.file-attachment-card') ||
            e.target.closest('a') ||
            e.target.closest('button')) {
            return;
        }
    };

    const handleBubbleDoubleClick = (e) => {
        if (isMobile) return;
        if (e.target.closest('.replied-message-preview') || 
            e.target.closest('.message-media-wrap') || 
            e.target.closest('.view-once-placeholder') ||
            e.target.closest('.file-attachment-card') ||
            e.target.closest('a') ||
            e.target.closest('button')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        setMobileDropdown(prev => !prev);
    };

    const handleCapsuleClick = (e) => {
        e.stopPropagation();
        setShowDetailsModal(true);
    };

    const sortedReactions = useMemo(() => {
        if (!message.reactions || !message.reactions.length) return [];
        const peerReaction = message.reactions.find(r => r.userId === otherUser?._id || r.userId?.toString() === otherUser?._id);
        const myReaction = message.reactions.find(r => r.userId === user?._id || r.userId?.toString() === user?._id);
        const list = [];
        if (peerReaction) list.push(peerReaction);
        if (myReaction) list.push(myReaction);
        message.reactions.forEach(r => {
            if (r.userId !== otherUser?._id && r.userId !== user?._id && r.userId?.toString() !== otherUser?._id && r.userId?.toString() !== user?._id) {
                list.push(r);
            }
        });
        return list;
    }, [message.reactions, otherUser?._id, user?._id]);

    const userHasReacted = useMemo(() => {
        return message.reactions?.some(r => r.userId === user?._id || r.userId?.toString() === user?._id) || false;
    }, [message.reactions, user?._id]);

    useEffect(() => {
        if (needsLoading && imgRef.current && imgRef.current.complete) {
            setIsMediaLoaded(true);
        }
    }, [needsLoading, message.mediaUrl]);

    const repliedToMessage = useMemo(() => {
        if (!message.replyTo) return null;
        if (typeof message.replyTo === 'object' && message.replyTo._id) return message.replyTo;
        const messages = useChatStore.getState().messages;
        return messages[message.chatId]?.find(m => m._id === message.replyTo);
    }, [message.replyTo, message.chatId]);

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
            if (e.target.closest('.mobile-bottom-sheet') || e.target.closest('.message-dropdown')) {
                return;
            }
            setMobileDropdown(false);
        };

        const handleScroll = () => {
            setMobileDropdown(false);
        };

        document.addEventListener("mousedown", handleOutside);
        document.addEventListener("touchstart", handleOutside);
        window.addEventListener("scroll", handleScroll, true);
        document.addEventListener("scroll", handleScroll, true);
        window.addEventListener("wheel", handleScroll, { passive: true });
        window.addEventListener("touchmove", handleScroll, { passive: true });

        return () => {
            document.removeEventListener("mousedown", handleOutside);
            document.removeEventListener("touchstart", handleOutside);
            window.removeEventListener("scroll", handleScroll, true);
            document.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("wheel", handleScroll);
            window.removeEventListener("touchmove", handleScroll);
        };
    }, [mobileDropdown]);

    const getThumbnailUrl = (url) => {
        if (!url || !url.includes("cloudinary.com")) return url;
        return url.replace("/upload/", "/upload/c_limit,w_1000,q_auto,f_auto/");
    };

    const handleViewOnce = () => {
        if (onMediaClick && message.mediaUrl) {
            onMediaClick(message.mediaUrl, message.type, true);
            markViewOnceAsViewed(message._id, message.chatId);
        }
    };

    const messageAgeMs = Date.now() - new Date(message.createdAt).getTime();
    const isGhostDeleted = !message.content && !message.mediaUrl && !message.music && message.type === "text" && !message.deletedForEveryone && messageAgeMs > 15000;

    if (message.deletedForEveryone || isGhostDeleted) {
        return (
            <div className={`message-row ${isMe ? "mine" : "theirs"} ${zenFadeClass}`}>
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

    const isViewedByMe = message.viewedBy?.includes(user?._id);
    const isViewedByAnyone = message.viewedBy?.length > 0;

    return (
        <div
            id={`msg-${message._id}`}
            className={`message-row ${isMe ? "mine" : "theirs"} ${isNew ? "message-slide-up" : ""} ${zenFadeClass}`}
            style={!isShown ? { visibility: 'hidden', height: 0, overflow: 'hidden' } : {}}
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

            <div 
                className="message-bubble-outer" 
                ref={outerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className={`message-bubble ${isMe ? `mine status-${status === "read" ? "seen" : status}` : "theirs"} ${isViewOnce ? "view-once" : ""}`}
                    onClick={handleBubbleClick}
                    onDoubleClick={handleBubbleDoubleClick}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                    onContextMenu={(e) => { if (isMobile) e.preventDefault(); }}
                >
                    {isViewOnce && isMe ? (
                        <div className={`view-once-placeholder ${isViewedByAnyone ? 'viewed' : ''}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>{isViewedByAnyone ? "Media viewed" : "Media sent"}</span>
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
                            {(message.type === "image" || message.type === "video" || message.type === "file") && message.mediaUrl && !isViewOnce && (
                                <div 
                                    className="message-media-wrap" 
                                    onClick={() => {
                                        if (shouldDelayLoad) {
                                            setManualLoad(true);
                                        } else if (onMediaClick) {
                                            onMediaClick(message.mediaUrl, message.type, message.isViewOnce || false);
                                        }
                                    }} 
                                    onDoubleClick={(e) => e.stopPropagation()} 
                                    style={{ cursor: 'pointer' }}
                                >
                                     {shouldDelayLoad ? (
                                         <div 
                                             className="media-bandwidth-placeholder" 
                                             style={{
                                                 display: 'flex',
                                                 flexDirection: 'column',
                                                 alignItems: 'center',
                                                 justifyContent: 'center',
                                                 background: 'rgba(15, 23, 42, 0.65)',
                                                 backdropFilter: 'blur(8px)',
                                                 borderRadius: '8px',
                                                 width: '240px',
                                                 height: '160px',
                                                 border: '1px dashed rgba(255,255,255,0.15)',
                                                 gap: '8px',
                                                 padding: '16px',
                                                 position: 'relative',
                                                 overflow: 'hidden'
                                             }}
                                         >
                                             {message.mediaUrl && (
                                                 <img 
                                                     src={message.mediaUrl.includes("cloudinary.com") 
                                                         ? message.mediaUrl.replace("/upload/", "/upload/c_fill,w_120,h_80,q_10,f_auto,e_blur:200/") 
                                                         : message.mediaUrl}
                                                     alt="" 
                                                     style={{
                                                         position: 'absolute',
                                                         inset: 0,
                                                         width: '100%',
                                                         height: '100%',
                                                         objectFit: 'cover',
                                                         opacity: 0.35,
                                                         filter: 'blur(4px)',
                                                         pointerEvents: 'none'
                                                     }} 
                                                 />
                                             )}
                                             <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)', opacity: 0.8 }}>
                                                     <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                     <polyline points="7 10 12 15 17 10" />
                                                     <line x1="12" y1="15" x2="12" y2="3" />
                                                 </svg>
                                                 <span style={{ fontSize: '12px', fontWeight: '500', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.2px' }}>
                                                     Tap to load {message.type}
                                                 </span>
                                                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                                                      #SP-OP mode active
                                                  </span>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="message-media-wrap" style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                             {message.type === "image" ? (
                                                 <img 
                                                      ref={imgRef}
                                                      src={getThumbnailUrl(message.mediaUrl)} 
                                                      alt="Sent image" 
                                                      className="message-image" 
                                                      loading="lazy" 
                                                      onLoad={() => setIsMediaLoaded(true)}
                                                  />
                                             ) : message.type === "video" ? (
                                                 <video 
                                                      src={message.mediaUrl} 
                                                      className="message-video" 
                                                      style={{ maxWidth: '100%', borderRadius: '8px' }} 
                                                      onLoadedData={() => setIsMediaLoaded(true)}
                                                      controls
                                                      playsInline
                                                  />
                                             ) : (
                                                 <div className="file-attachment-card" style={{
                                                     background: 'rgba(255,255,255,0.05)',
                                                     border: '1px solid rgba(255,255,255,0.08)',
                                                     borderRadius: '12px',
                                                     padding: '12px 16px',
                                                     display: 'flex',
                                                     alignItems: 'center',
                                                     gap: '12px',
                                                     minWidth: '180px'
                                                 }}>
                                                     <div className="file-icon" style={{
                                                         background: 'rgba(59, 130, 246, 0.15)',
                                                         color: '#3b82f6',
                                                         width: '36px',
                                                         height: '36px',
                                                         borderRadius: '10px',
                                                         display: 'flex',
                                                         alignItems: 'center',
                                                         justifyContent: 'center'
                                                     }}>
                                                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                                         </svg>
                                                     </div>
                                                     <div style={{ flex: 1, minWidth: 0 }}>
                                                         <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                             {message.content || "Document"}
                                                         </div>
                                                         <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                                             Attachment
                                                         </div>
                                                     </div>
                                                     <a
                                                         href={message.mediaUrl}
                                                         target="_blank"
                                                         rel="noopener noreferrer"
                                                         download
                                                         onClick={(e) => e.stopPropagation()}
                                                         style={{ color: '#94a3b8', padding: '4px', borderRadius: '6px', transition: 'all 0.2s' }}
                                                         onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                                         onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                     >
                                                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                             <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                                         </svg>
                                                     </a>
                                                 </div>
                                             )}
                                             
                                             {status === "sending" && (message.type === "image" || message.type === "video") && (
                                                 <div className="media-upload-overlay" style={{
                                                     position: 'absolute',
                                                     top: 0,
                                                     left: 0,
                                                     right: 0,
                                                     bottom: 0,
                                                     display: 'flex',
                                                     alignItems: 'center',
                                                     justifyContent: 'center',
                                                     background: 'rgba(15, 23, 42, 0.4)',
                                                     backdropFilter: 'blur(6px)',
                                                     borderRadius: '8px',
                                                     zIndex: 10
                                                 }}>
                                                     <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}>
                                                         <circle cx="16" cy="16" r="13" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2.5"/>
                                                         <circle
                                                             cx="16" cy="16" r="13"
                                                             stroke="var(--color-primary)"
                                                             strokeWidth="2.5"
                                                             strokeLinecap="round"
                                                             strokeDasharray={`${2 * Math.PI * 13}`}
                                                             strokeDashoffset={`${2 * Math.PI * 13 * (1 - (progress || 0) / 100)}`}
                                                             transform="rotate(-90 16 16)"
                                                             style={{ transition: 'stroke-dashoffset 0.15s ease' }}
                                                         />
                                                         <text x="16" y="20.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--color-primary)" fontFamily="inherit">Z</text>
                                                     </svg>
                                                 </div>
                                             )}
                                         </div>
                                     )}
                                </div>
                            )}
                            {message.content && (
                                <span className="message-text">
                                    <DecryptedText
                                        text={message.content}
                                        animate={isNew && !isMe && message.canSeeScramble && !isLowBandwidth && !message.isLowBandwidth}
                                    />
                                </span>
                            )}
                            {status === "sending" && message.type !== "image" && message.type !== "video" && (
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
                            {message.isZenMessage && (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="zen-tag-icon" title="Sent in ZenMode">
                                    <circle cx="12" cy="12" r="10" />
                                    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--color-primary)" stroke="none" fontFamily="inherit">Z</text>
                                </svg>
                            )}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span className="message-time">
                                    {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </span>
                        </div>

                </div>

                {!isMobile && (
                    <div className={`message-dropdown ${mobileDropdown ? "visible" : ""} ${!isMe ? "theirs-dropdown" : ""}`}>
                        {!isZenMode && (
                            <button
                                className="message-dropdown-item"
                                onMouseDown={(e) => { e.preventDefault(); setMobileDropdown(false); toggleStarMessage(message._id, message.chatId); }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <span>{message.starredBy?.includes(user?._id) ? "Unfav" : "Fav"}</span>
                            </button>
                        )}
                        {canReply && (
                            <button
                                className="message-dropdown-item"
                                onMouseDown={(e) => { e.preventDefault(); setMobileDropdown(false); onEdit({ action: "reply", ...message }); }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                    <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                                </svg>
                                <span>Reply</span>
                            </button>
                        )}
                        {isMe && canDelete && !isZenMode && (
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
                )}

                {showReactionsPill && (
                    <div 
                        className="reactions-hover-pill"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        {Object.keys(REACTIONS_MAP).map(key => {
                            const Icon = REACTIONS_MAP[key];
                            return (
                                <button
                                    key={key}
                                    className={`reaction-option-btn reaction-${key}`}
                                    onClick={() => handleReact(key)}
                                    title={key}
                                >
                                    <Icon size={18} />
                                </button>
                            );
                        })}
                    </div>
                )}

                {sortedReactions.length > 0 && (
                    <div 
                        className={`bubble-reactions-capsule reactions-count-${message.reactions.length === 1 ? '1' : 'multi'} ${userHasReacted ? "user-has-reacted" : ""}`}
                        onClick={handleCapsuleClick}
                    >
                        {sortedReactions.map((r, i) => {
                            const Icon = REACTIONS_MAP[r.emoji];
                            if (!Icon) return null;
                            const isSelf = r.userId === user?._id || r.userId?.toString() === user?._id;
                            const name = isSelf ? "You" : (otherUser?.username || "User");
                            const itemClass = isSelf ? "is-own" : "is-peer";
                            return (
                                <div key={i} className={`bubble-reaction-item ${itemClass} reaction-${r.emoji}`} title={`${name} reacted`}>
                                    <Icon size={message.reactions.length === 1 ? 10 : 12} />
                                </div>
                            );
                        })}
                        {message.reactions.length > 1 && (
                            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginLeft: '2px' }}>
                                {message.reactions.length}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {isMobile && mobileDropdown && createPortal(
                <div 
                    className="mobile-bottom-sheet-overlay" 
                    onClick={() => setMobileDropdown(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(9, 13, 20, 0.7)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 999999,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div 
                        className="mobile-bottom-sheet"
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '500px',
                            background: '#161b22',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            borderTopLeftRadius: '24px',
                            borderTopRightRadius: '24px',
                            padding: '16px 20px 32px',
                            boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            animation: 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxSizing: 'border-box'
                        }}
                    >
                        <div style={{ width: '36px', height: '4px', background: 'rgba(255, 255, 255, 0.16)', borderRadius: '2px', margin: '0 auto 12px' }} />
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 8px 4px' }}>
                            Message Options
                        </div>

                        {!isZenMode && (
                            <button
                                className="bottom-sheet-item"
                                onClick={() => { setMobileDropdown(false); toggleStarMessage(message._id, message.chatId); }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '14px 16px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: '#c9d1d9',
                                    fontSize: '0.92rem',
                                    fontWeight: 500,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill={message.starredBy?.includes(user?._id) ? "#eab308" : "none"} stroke={message.starredBy?.includes(user?._id) ? "#eab308" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <span>{message.starredBy?.includes(user?._id) ? "Unfavorite Message" : "Favorite Message"}</span>
                            </button>
                        )}

                        {canReply && (
                            <button
                                className="bottom-sheet-item"
                                onClick={() => { setMobileDropdown(false); onEdit({ action: "reply", ...message }); }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '14px 16px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: '#c9d1d9',
                                    fontSize: '0.92rem',
                                    fontWeight: 500,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                                </svg>
                                <span>Reply</span>
                            </button>
                        )}

                        {isMe && canDelete && !isZenMode && (
                            <>
                                {isWithinEditWindow && (
                                    <button
                                        className="bottom-sheet-item"
                                        onClick={() => { setMobileDropdown(false); onEdit(message); }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '14px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            borderRadius: '12px',
                                            color: '#c9d1d9',
                                            fontSize: '0.92rem',
                                            fontWeight: 500,
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s ease'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                        <span>Edit Message</span>
                                    </button>
                                )}
                                <button
                                    className="bottom-sheet-item delete"
                                    onClick={() => { setMobileDropdown(false); onDelete(message); }}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '14px 16px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: '#f85149',
                                        fontSize: '0.92rem',
                                        fontWeight: 600,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s ease'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,81,73,0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                    </svg>
                                    <span>Delete Message</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {reactionsSheetOpen && createPortal(
                <div 
                    className="mobile-bottom-sheet-overlay" 
                    onClick={() => setReactionsSheetOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(9, 13, 20, 0.7)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 9999999,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div 
                        className="mobile-bottom-sheet"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            background: '#161b22',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            borderTopLeftRadius: '24px',
                            borderTopRightRadius: '24px',
                            padding: '24px',
                            boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>React to message</span>
                            <button 
                                onClick={() => setReactionsSheetOpen(false)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#64748b', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 0' }}>
                            {Object.keys(REACTIONS_MAP).map(key => {
                                const Icon = REACTIONS_MAP[key];
                                return (
                                    <button
                                        key={key}
                                        className={`reaction-option-btn reaction-${key}`}
                                        onClick={() => handleReact(key)}
                                        style={{ width: '40px', height: '40px' }}
                                    >
                                        <Icon size={24} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showDetailsModal && createPortal(
                <div 
                    className="mobile-bottom-sheet-overlay" 
                    onClick={() => setShowDetailsModal(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(9, 13, 20, 0.7)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        zIndex: 9999999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div 
                        className="reactions-detail-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="reactions-detail-header">
                            <span className="reactions-detail-title">Message Reactions</span>
                            <button className="reactions-detail-close" onClick={() => setShowDetailsModal(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="reactions-detail-body">
                            {message.reactions && message.reactions.map((r, i) => {
                                const Icon = REACTIONS_MAP[r.emoji];
                                const isSelf = r.userId === user?._id || r.userId?.toString() === user?._id;
                                const displayUsername = isSelf ? "You" : (otherUser?.username || "User");
                                const displayAvatar = isSelf ? user?.avatar : otherUser?.avatar;
                                
                                return (
                                    <div key={i} className={`reaction-row-item ${isSelf ? "is-own" : ""}`}>
                                        <div className="reaction-user-info">
                                            <div className="reaction-user-avatar">
                                                {displayAvatar ? (
                                                    <img src={displayAvatar} alt={displayUsername} />
                                                ) : (
                                                    <span>{displayUsername.slice(0, 2).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <span className="reaction-user-name">@{displayUsername}</span>
                                        </div>
                                        <div 
                                            className={`reaction-row-badge reaction-${r.emoji}`} 
                                            style={{ cursor: isSelf ? 'pointer' : 'default' }} 
                                            onClick={() => { 
                                                if (isSelf) { 
                                                    handleReact(r.emoji); 
                                                    setShowDetailsModal(false); 
                                                } 
                                            }}
                                            title={isSelf ? "Remove Reaction" : undefined}
                                        >
                                            {Icon && <Icon size={18} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default memo(MessageBubble);