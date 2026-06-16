import { useState, useRef, useEffect, memo, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { useMomentStore } from "../../stores/momentStore";
import { useSocket } from "../../context/SocketContext";
import DecryptedText from "./DecryptedText";
import VoiceMessageBubble from "./VoiceMessageBubble";

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

const getFileName = (url, content) => {
    if (!url) return content || "Document";
    try {
        const decoded = decodeURIComponent(url);
        const parts = decoded.split('/');
        const filename = parts[parts.length - 1];
        const hasExtension = (str) => /\.[a-zA-Z0-9]{2,5}$/.test(str);
        if (content && hasExtension(content)) {
            return content;
        }
        return filename || content || "Document";
    } catch (e) {
        return content || "Document";
    }
};

const triggerDownload = async (e, mediaUrl, content, senderUsername) => {
    e.preventDefault();
    e.stopPropagation();
    try {
        const fileName = getFileName(mediaUrl, content);
        const dotIndex = fileName.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
        const extension = dotIndex !== -1 ? fileName.slice(dotIndex) : '';
        const downloadName = `${baseName}_${senderUsername}_zenchat${extension}`;

        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error("Download failed:", err);
        window.open(mediaUrl, "_blank");
    }
};

const MessageBubble = ({ message, isMe, showAvatar, otherUser, onEdit, onDelete, onMediaClick, canDelete = true, canReply = true, zenFadeClass = "", isSelected = false, isMultiSelectMode = false, onSelect }) => {
    const user = useAuthStore((s) => s.user);
    const { toggleStarMessage, markViewOnceAsViewed } = useChatStore.getState();
    const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);
    const isZenMode = useChatStore((s) => s.isZenMode);
    const zenUsers = useChatStore((s) => s.zenUsers);
    
    const senderUsername = isMe ? (user?.username || "user") : (otherUser?.username || "user");
    
    // Unified bottom sheet (mobile): shows reactions + actions
    const [mobileSheet, setMobileSheet] = useState(false);
    // Desktop right-click context popup
    const [desktopMenu, setDesktopMenu] = useState(null); // { x, y }
    const { reactToMessage } = useSocket();
    const [showReactionsPill, setShowReactionsPill] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const isLocalBlob = (message.type === "image" || message.type === "video" || message.type === "gif") &&
        !!message.mediaUrl?.startsWith("blob:");
    const [isMediaLoaded, setIsMediaLoaded] = useState(isLocalBlob);
    const [manualLoad, setManualLoad] = useState(false);
    
    // Swipe to reply state
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [showReplyIcon, setShowReplyIcon] = useState(false);
    
    const reactionsTimeoutRef = useRef(null);
    const lastTapRef = useRef(0);
    const tapTimeoutRef = useRef(null);
    const imgRef = useRef(null);
    const outerRef = useRef(null);
    const desktopMenuRef = useRef(null);

    // Sync body class to lock text selection while sheet is open
    useEffect(() => {
        if (mobileSheet) {
            document.body.classList.add('reactions-sheet-open');
            window.getSelection()?.removeAllRanges();
        } else {
            document.body.classList.remove('reactions-sheet-open');
        }
        return () => document.body.classList.remove('reactions-sheet-open');
    }, [mobileSheet]);

    // Close desktop context menu on click-outside
    useEffect(() => {
        if (!desktopMenu) return;
        const handler = (e) => {
            if (!desktopMenuRef.current?.contains(e.target)) setDesktopMenu(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [desktopMenu]);

    // Touch gesture state tracking
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
    const preventClickRef = useRef(false);

    const isMobile = window.innerWidth <= 768;
    const shouldDelayLoad = isLowBandwidth && !isMe && !manualLoad;
    const status = message?.status ?? "sent";
    const progress = message?.progress ?? 0;
    const isViewOnce = message.isViewOnce;
    const isMediaMsg = (message.type === "image" || message.type === "video") && message.mediaUrl;
    const needsLoading = isMediaMsg && !isViewOnce && !shouldDelayLoad && status !== "sending";
    const isShown = true;

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
            time: Date.now(),
            validSwipe: false
        };
        setSwipeOffset(0);
        setShowReplyIcon(false);
        preventClickRef.current = false;
    };

    const handleTouchMove = (e) => {
        if (!isMobile) return;
        const touch = e.touches[0];
        const diffX = Math.abs(touch.clientX - touchStartRef.current.x);
        const diffY = Math.abs(touch.clientY - touchStartRef.current.y);
        
        if (diffX > 15 || diffY > 15) {
            // Movement detected - cancel any pending actions
        }

        if (diffY < 30 && diffX > 10) {
            const deltaX = touch.clientX - touchStartRef.current.x;
            if ((isMe && deltaX < 0) || (!isMe && deltaX > 0)) {
                const offset = isMe ? Math.max(deltaX, -80) : Math.min(deltaX, 80);
                setSwipeOffset(offset);
                setShowReplyIcon(Math.abs(offset) > 50);
                touchStartRef.current.validSwipe = true;
            }
        }
    };

    const handleTouchEnd = (e) => {
        if (!isMobile) return;

        if (touchStartRef.current.validSwipe) {
            if (showReplyIcon && canReply && onEdit) {
                onEdit({ action: "reply", ...message });
                if (navigator.vibrate) navigator.vibrate(50);
            }
            setSwipeOffset(0);
            setShowReplyIcon(false);
            touchStartRef.current.validSwipe = false;
            return;
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
                // Double-tap: open options bottom sheet
                if (tapTimeoutRef.current) {
                    clearTimeout(tapTimeoutRef.current);
                    tapTimeoutRef.current = null;
                }
                e.preventDefault();
                e.stopPropagation();
                if (navigator.vibrate) navigator.vibrate(50);
                setMobileSheet(true);
            } else {
                lastTapRef.current = now;
            }
        }
    };

    const handleTouchCancel = () => {
        setSwipeOffset(0);
        setShowReplyIcon(false);
        preventClickRef.current = false;
    };

    const handleReact = (emojiKey) => {
        reactToMessage(message.chatId, message._id, emojiKey);
        setShowReactionsPill(false);
        setMobileSheet(false);
    };

    const handleBubbleClick = (e) => {
        // In multi-select mode, tap anywhere on the row toggles selection
        if (isMultiSelectMode) {
            e.preventDefault();
            e.stopPropagation();
            if (onSelect) onSelect(message._id);
            return;
        }
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
        // Desktop double-click: enter multi-select mode
        if (onEdit) onEdit({ action: 'select', ...message });
    };

    const handleContextMenu = (e) => {
        if (isMobile) { e.preventDefault(); return; }
        e.preventDefault();
        e.stopPropagation();
        setDesktopMenu({ x: e.clientX, y: e.clientY });
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

    const repliedToMoment = useMemo(() => {
        if (!message.replyToMoment) return null;
        if (typeof message.replyToMoment === 'object' && message.replyToMoment._id) return message.replyToMoment;
        return null;
    }, [message.replyToMoment]);

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

    const desktopMenuItemStyle = {
        width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
        padding: '8px 12px', background: 'transparent', border: 'none',
        borderRadius: '8px', color: '#c9d1d9', fontSize: '0.875rem', fontWeight: 500,
        textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'background 0.12s'
    };

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
            className={`message-row ${isMe ? "mine" : "theirs"} ${isNew ? "message-slide-up" : ""} ${zenFadeClass} ${isSelected ? "message-row--selected" : ""} ${isMultiSelectMode ? "message-row--selectable" : ""}`}
            style={!isShown ? { visibility: 'hidden', height: 0, overflow: 'hidden' } : {}}
            onClick={isMultiSelectMode ? (e) => { e.preventDefault(); e.stopPropagation(); if (onSelect) onSelect(message._id); } : undefined}
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

            {/* Swipe Reply Icon */}
            {swipeOffset !== 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        [isMe ? 'right' : 'left']: isMe ? '16px' : (showAvatar ? '50px' : '16px'),
                        opacity: showReplyIcon ? 1 : Math.min(Math.abs(swipeOffset) / 50, 0.5),
                        transition: 'opacity 0.2s',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--color-overlay, rgba(255, 255, 255, 0.05))',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        pointerEvents: 'none'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                    </svg>
                </div>
            )}

            <div 
                className="message-bubble-outer" 
                ref={outerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{
                    transform: `translateX(${swipeOffset}px)`,
                    transition: swipeOffset === 0 ? 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                    position: 'relative',
                    zIndex: 2
                }}
            >
                <div
                    className={`message-bubble ${isMe ? `mine status-${status === "read" ? "seen" : status}` : "theirs"} ${isViewOnce ? "view-once" : ""} ${message.type === 'sticker' ? "is-sticker" : ""}`}
                    onClick={handleBubbleClick}
                    onDoubleClick={handleBubbleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                >
                    {/* Forwarded label */}
                    {message.isForwarded && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'rgba(148,163,184,0.75)', marginBottom: '4px', fontStyle: 'italic' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 10 20 15 15 20" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
                            </svg>
                            Forwarded
                        </div>
                    )}
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
                                                {repliedToMessage.type === 'voice' ? `Voice message (${repliedToMessage.content})` : (repliedToMessage.content || (
                                                    repliedToMessage.type === 'image' ? 'Image' :
                                                    repliedToMessage.type === 'gif' ? 'GIF' :
                                                    repliedToMessage.type === 'sticker' ? 'Sticker' :
                                                    repliedToMessage.type === 'video' ? 'Video' :
                                                    repliedToMessage.type === 'file' ? 'File' :
                                                    'Media'
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="replied-content" style={{ opacity: 0.6, fontStyle: 'italic', fontSize: '0.8rem' }}>
                                            Original message deleted
                                        </div>
                                    )}
                                </div>
                            )}
                            {(message.replyToMoment || message.replyToMomentUsername) && (
                                <div
                                    className="replied-message-preview moment-reply-tag"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (repliedToMoment) {
                                            const momentOwnerId = (repliedToMoment.userId?._id || repliedToMoment.userId)?.toString();
                                            const isOwn = momentOwnerId === user?._id?.toString();
                                            if (!isOwn) {
                                                const isOtherInZen = momentOwnerId && (zenUsers[momentOwnerId] || zenUsers[momentOwnerId.toString()]);
                                                if (isZenMode || isOtherInZen) {
                                                    return; // Block other users' moments in ZenMode
                                                }
                                            }
                                            useMomentStore.getState().setActiveViewerMoments([repliedToMoment]);
                                        }
                                    }}
                                    style={{ cursor: repliedToMoment ? 'pointer' : 'default', borderLeftColor: '#10b981' }}
                                >
                                    <div className="replied-sender" style={{ color: '#10b981' }}>
                                        #Moment
                                    </div>
                                    <div className="replied-content">
                                        {message.replyToMomentUsername ? `@${message.replyToMomentUsername}'s moment` : 'View moment'}
                                        {!repliedToMoment && <span style={{ opacity: 0.5, fontStyle: 'italic' }}> (expired)</span>}
                                    </div>
                                </div>
                            )}
                            {message.type === "voice" && (
                                <VoiceMessageBubble message={message} />
                            )}
                            {(message.type === "image" || message.type === "video" || message.type === "file" || message.type === "gif" || message.type === "sticker") && !isViewOnce && (
                                <div 
                                    className="message-media-wrap" 
                                    onClick={() => {
                                        if (shouldDelayLoad) {
                                            setManualLoad(true);
                                        } else if (onMediaClick && message.mediaUrl) {
                                            onMediaClick(message.mediaUrl, message.type, message.isViewOnce || false);
                                        }
                                    }} 
                                    onDoubleClick={(e) => e.stopPropagation()} 
                                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
                                >
                                     {shouldDelayLoad ? (
                                         <div 
                                             className="media-bandwidth-placeholder" 
                                             style={{
                                                 display: 'flex',
                                                 flexDirection: 'column',
                                                 alignItems: 'center',
                                                 justifyContent: 'center',
                                                 background: "var(--color-surface, rgba(15, 23, 42, 0.65))",
                                                 backdropFilter: 'blur(8px)',
                                                 borderRadius: '8px',
                                                 width: '100%',
                                                 maxWidth: '240px',
                                                 height: '160px',
                                                 border: '1px dashed var(--color-border, rgba(255, 255, 255, 0.08))',
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
                                                     <line x1="12" y1="3" x2="12" y2="15" />
                                                 </svg>
                                                 <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-text, rgba(255, 255, 255, 0.9))', letterSpacing: '0.2px' }}>
                                                     Tap to load {message.type}
                                                 </span>
                                                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted, rgba(255, 255, 255, 0.5))', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                                                      #SP-OP mode active
                                                  </span>
                                             </div>
                                         </div>
                                     ) : (
                                          <div className="message-media-wrap" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                               {!message.mediaUrl ? (
                                                   message.type === "file" ? (
                                                       <div className="file-attachment-card media-loading-skeleton" style={{
                                                           background: 'rgba(0, 0, 0, 0.3)',
                                                           border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))',
                                                           borderRadius: '12px',
                                                           padding: '12px 16px',
                                                           display: 'flex',
                                                           alignItems: 'center',
                                                           gap: '12px',
                                                           minWidth: '180px',
                                                           maxWidth: '100%',
                                                           width: '100%',
                                                           boxSizing: 'border-box'
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
                                                               <div className="loader-sm" style={{ width: '16px', height: '16px', border: '2px solid var(--color-border, rgba(255, 255, 255, 0.08))', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'aura-spin 0.8s linear infinite' }} />
                                                           </div>
                                                           <div style={{ flex: 1, minWidth: 0 }}>
                                                               <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                   {status === "sending" ? "Uploading file..." : "Decrypting file..."}
                                                               </div>
                                                               <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                                                   Please wait
                                                               </div>
                                                           </div>
                                                       </div>
                                                   ) : (
                                                       <div className="media-loading-skeleton" style={{ width: '240px', height: '180px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)' }}>
                                                           <div className="media-upload-overlay" style={{
                                                               position: 'absolute',
                                                               inset: 0,
                                                               display: 'flex',
                                                               alignItems: 'center',
                                                               justifyContent: 'center',
                                                               background: "var(--color-surface, rgba(15, 23, 42, 0.4))",
                                                               backdropFilter: 'blur(6px)',
                                                               borderRadius: '8px',
                                                               zIndex: 10
                                                           }}>
                                                               {status === "sending" ? (
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
                                                               ) : (
                                                                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                                                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ptr-arc-spin">
                                                                           <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
                                                                       </svg>
                                                                       <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text, rgba(255, 255, 255, 0.7))' }}>Decrypting media...</span>
                                                                   </div>
                                                               )}
                                                           </div>
                                                       </div>
                                                   )
                                               ) : message.type === "image" ? (
                                                  <div className={!isMediaLoaded ? "media-loading-skeleton" : ""} style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)', margin: '0 auto 4px', maxWidth: '100%', maxHeight: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minWidth: '200px', minHeight: '150px' }}>
                                                      {message.lqip && !isMediaLoaded && (
                                                          <img
                                                              src={message.lqip}
                                                              alt="placeholder"
                                                              style={{
                                                                  position: 'absolute',
                                                                  inset: 0,
                                                                  width: '100%',
                                                                  height: '100%',
                                                                  objectFit: 'cover',
                                                                  filter: 'blur(8px)',
                                                                  transform: 'scale(1.1)',
                                                                  zIndex: 1
                                                              }}
                                                          />
                                                      )}
                                                      {!isMediaLoaded && !message.lqip && (
                                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 3, color: '#64748b', position: 'absolute' }}>
                                                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ptr-arc-spin">
                                                                  <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
                                                              </svg>
                                                              <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-muted, rgba(255, 255, 255, 0.5))' }}>Loading image...</span>
                                                          </div>
                                                      )}
                                                      <img 
                                                          ref={imgRef}
                                                          src={getThumbnailUrl(message.mediaUrl)} 
                                                          alt={message.type} 
                                                          className="message-image" 
                                                          loading="eager" 
                                                          onLoad={() => setIsMediaLoaded(true)}
                                                          style={{
                                                              opacity: isMediaLoaded ? 1 : 0,
                                                              transition: 'opacity 0.3s ease-in-out',
                                                              position: 'relative',
                                                              zIndex: 2,
                                                              margin: 0
                                                          }}
                                                      />
                                                  </div>
                                              ) : (message.type === "gif" || message.type === "sticker") ? (
                                                  <div className={!isMediaLoaded ? "media-loading-skeleton" : ""} style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)', margin: '0 auto 4px', maxWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minWidth: !isMediaLoaded ? '200px' : 'auto', minHeight: !isMediaLoaded ? '150px' : 'auto' }}>
                                                      {!isMediaLoaded && (
                                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 3, color: '#64748b', position: 'absolute' }}>
                                                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ptr-arc-spin">
                                                                  <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
                                                              </svg>
                                                              <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-muted, rgba(255, 255, 255, 0.5))' }}>Loading {message.type === "gif" ? "GIF" : "sticker"}...</span>
                                                          </div>
                                                      )}
                                                      <img 
                                                           ref={imgRef}
                                                           src={message.mediaUrl} 
                                                           alt={message.type} 
                                                           className={message.type === "sticker" ? "message-sticker" : "message-image"} 
                                                           loading="eager" 
                                                           onLoad={() => setIsMediaLoaded(true)}
                                                           style={{
                                                               opacity: isMediaLoaded ? 1 : 0,
                                                               transition: 'opacity 0.3s ease-in-out',
                                                               width: '100%',
                                                               height: '100%',
                                                               objectFit: 'contain'
                                                           }}
                                                      />
                                                  </div>
                                              ) : message.type === "video" ? (
                                                  <div className={!isMediaLoaded ? "media-loading-skeleton" : ""} style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)', margin: '0 auto', maxWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minWidth: !isMediaLoaded ? '240px' : 'auto', minHeight: !isMediaLoaded ? '180px' : 'auto' }}>
                                                      {!isMediaLoaded && (
                                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 3, color: '#64748b', position: 'absolute' }}>
                                                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ptr-arc-spin">
                                                                  <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
                                                              </svg>
                                                              <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-muted, rgba(255, 255, 255, 0.5))' }}>Loading video...</span>
                                                          </div>
                                                      )}
                                                      <video 
                                                           src={message.mediaUrl} 
                                                           className="message-video" 
                                                           style={{ 
                                                               opacity: isMediaLoaded ? 1 : 0,
                                                               transition: 'opacity 0.3s ease-in-out',
                                                               maxWidth: '100%', 
                                                               borderRadius: '8px', 
                                                               margin: '0 auto', 
                                                               display: 'block' 
                                                           }} 
                                                           onLoadedData={() => setIsMediaLoaded(true)}
                                                           controls
                                                           playsInline
                                                      />
                                                  </div>
                                              ) : (
                                                   <div className="file-attachment-card" style={{
                                                       background: 'rgba(0, 0, 0, 0.3)',
                                                       border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))',
                                                       borderRadius: '12px',
                                                       padding: '12px 16px',
                                                       display: 'flex',
                                                       alignItems: 'center',
                                                       gap: '12px',
                                                       minWidth: '180px',
                                                       maxWidth: '100%',
                                                       width: '100%',
                                                       boxSizing: 'border-box',
                                                       cursor: 'pointer'
                                                   }} onClick={(e) => {
                                                       e.stopPropagation();
                                                       onMediaClick(message.mediaUrl, 'file', false);
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
                                                               {getFileName(message.mediaUrl, message.content)}
                                                           </div>
                                                           <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                                               {getFileName(message.mediaUrl, message.content).split('.').pop()?.toUpperCase() || 'FILE'} File
                                                           </div>
                                                       </div>
                                                      <a
                                                          href={message.mediaUrl}
                                                          onClick={(e) => triggerDownload(e, message.mediaUrl, message.content, senderUsername)}
                                                          style={{ color: '#94a3b8', padding: '4px', borderRadius: '6px', transition: 'all 0.2s', cursor: 'pointer' }}
                                                           onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                                           onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                      >
                                                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                                          </svg>
                                                      </a>
                                                   </div>
                                              )}
                                              
                                              {status === "sending" && message.mediaUrl && (message.type === "image" || message.type === "video") && (
                                                 <div className="media-upload-overlay" style={{
                                                     position: 'absolute',
                                                     top: 0,
                                                     left: 0,
                                                     right: 0,
                                                     bottom: 0,
                                                     display: 'flex',
                                                     alignItems: 'center',
                                                     justifyContent: 'center',
                                                     background: "var(--color-surface, rgba(15, 23, 42, 0.4))",
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
                            {message.content && message.type !== "voice" && (
                                <span className="message-text">
                                    <DecryptedText
                                        text={message.content}
                                        animate={isNew && !isMe && !isLowBandwidth && !message.isLowBandwidth}
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

            {/* â”€â”€ MOBILE: Unified long-press bottom sheet (reactions + actions) â”€â”€ */}
            {isMobile && mobileSheet && createPortal(
                <div
                    className="mobile-bottom-sheet-overlay"
                    onClick={() => setMobileSheet(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(9, 13, 20, 0.72)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        zIndex: 9999999,
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div
                        className="mobile-bottom-sheet"
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            background: "var(--color-surface, linear-gradient(180deg, #1a2030 0%, #161b22 100%))",
                            borderTopLeftRadius: '24px',
                            borderTopRightRadius: '24px',
                            padding: '0 0 env(safe-area-inset-bottom, 24px)',
                            boxShadow: '0 -12px 48px rgba(0,0,0,0.6)',
                            display: 'flex', flexDirection: 'column',
                            animation: 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxSizing: 'border-box'
                        }}
                    >
                        {/* Reactions row */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-evenly', alignItems: 'center',
                            padding: '16px 20px 12px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)'
                        }}>
                            {Object.keys(REACTIONS_MAP).map(key => {
                                const Icon = REACTIONS_MAP[key];
                                const hasReacted = message.reactions?.some(r => (r.userId === user?._id || r.userId?.toString() === user?._id) && r.emoji === key);
                                return (
                                    <button
                                        key={key}
                                        className={`reaction-option-btn reaction-${key}`}
                                        onClick={() => handleReact(key)}
                                        style={{
                                            width: '48px', height: '48px',
                                            transform: hasReacted ? 'scale(1.18)' : 'scale(1)',
                                            transition: 'transform 0.18s ease',
                                            borderRadius: '50%',
                                            background: hasReacted ? 'rgba(255,255,255,0.08)' : 'transparent',
                                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <Icon size={28} />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Action list */}
                        <div className="mobile-sheet-actions" style={{ display: 'flex', flexDirection: 'column', padding: '8px 0 16px' }}>
                            {!isZenMode && (
                                <button className="bottom-sheet-item" onClick={() => { setMobileSheet(false); toggleStarMessage(message._id, message.chatId); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', borderRadius: 0, color: '#c9d1d9', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onTouchStart={e => e.currentTarget.style.background = 'var(--color-border, rgba(255, 255, 255, 0.08))'}
                                    onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="19" height="19" viewBox="0 0 24 24" fill={message.starredBy?.includes(user?._id) ? "#eab308" : "none"} stroke={message.starredBy?.includes(user?._id) ? "#eab308" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                    <span>{message.starredBy?.includes(user?._id) ? "Unfavorite" : "Favorite"}</span>
                                </button>
                            )}

                            {canReply && (
                                <button className="bottom-sheet-item" onClick={() => { setMobileSheet(false); onEdit({ action: "reply", ...message }); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', borderRadius: 0, color: '#c9d1d9', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onTouchStart={e => e.currentTarget.style.background = 'var(--color-border, rgba(255, 255, 255, 0.08))'}
                                    onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                                    </svg>
                                    <span>Reply</span>
                                </button>
                            )}

                            {message.content && (
                                <button className="bottom-sheet-item" onClick={() => { setMobileSheet(false); navigator.clipboard.writeText(message.content); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', borderRadius: 0, color: '#c9d1d9', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onTouchStart={e => e.currentTarget.style.background = 'var(--color-border, rgba(255, 255, 255, 0.08))'}
                                    onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    <span>Copy</span>
                                </button>
                            )}

                            <button className="bottom-sheet-item" onClick={() => { setMobileSheet(false); if (onEdit) onEdit({ action: 'select', ...message }); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', borderRadius: 0, color: '#c9d1d9', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                onTouchStart={e => e.currentTarget.style.background = 'var(--color-border, rgba(255, 255, 255, 0.08))'}
                                onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                </svg>
                                <span>Select</span>
                            </button>

                            {canReply && (
                                <button className="bottom-sheet-item" onClick={() => { setMobileSheet(false); if (onEdit) onEdit({ action: 'forward', ...message }); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', borderRadius: 0, color: '#c9d1d9', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onTouchStart={e => e.currentTarget.style.background = 'var(--color-border, rgba(255, 255, 255, 0.08))'}
                                    onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="15 10 20 15 15 20" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
                                    </svg>
                                    <span>Forward</span>
                                </button>
                            )}

                            {isMe && canDelete && !isZenMode && (
                                <>
                                    {isWithinEditWindow && message.type !== "voice" && (
                                        <button className="bottom-sheet-item" onClick={() => { setMobileSheet(false); onEdit(message); }}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', borderRadius: 0, color: '#c9d1d9', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onTouchStart={e => e.currentTarget.style.background = 'var(--color-border, rgba(255, 255, 255, 0.08))'}
                                            onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                            <span>Edit</span>
                                        </button>
                                    )}
                                    <button className="bottom-sheet-item" onClick={() => { setMobileSheet(false); onDelete(message); }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', borderRadius: 0, color: '#f85149', fontSize: '0.93rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onTouchStart={e => e.currentTarget.style.background = 'rgba(248,81,73,0.07)'}
                                        onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                        </svg>
                                        <span>Delete</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* â”€â”€ DESKTOP: Right-click context popup â”€â”€ */}
            {!isMobile && desktopMenu && createPortal(
                <div
                    ref={desktopMenuRef}
                    style={{
                        position: 'fixed',
                        top: `${Math.min(desktopMenu.y, window.innerHeight - 280)}px`,
                        left: `${Math.min(desktopMenu.x, window.innerWidth - 200)}px`,
                        zIndex: 9999999,
                        background: 'rgba(17, 24, 36, 0.96)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))',
                        borderRadius: '14px',
                        padding: '6px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        minWidth: '176px',
                        animation: 'fadeIn 0.12s ease-out'
                    }}
                >
                    {canReply && (
                        <button onClick={() => { setDesktopMenu(null); onEdit({ action: 'reply', ...message }); }} style={desktopMenuItemStyle}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                            </svg>
                            Reply
                        </button>
                    )}
                    {message.content && (
                        <button onClick={() => { setDesktopMenu(null); navigator.clipboard.writeText(message.content); }} style={desktopMenuItemStyle}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy
                        </button>
                    )}
                    <button onClick={() => { setDesktopMenu(null); if (onEdit) onEdit({ action: 'select', ...message }); }} style={desktopMenuItemStyle}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                        Select
                    </button>
                    {canReply && (
                        <button onClick={() => { setDesktopMenu(null); if (onEdit) onEdit({ action: 'forward', ...message }); }} style={desktopMenuItemStyle}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <polyline points="15 10 20 15 15 20" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
                            </svg>
                            Forward
                        </button>
                    )}
                    {!isZenMode && (
                        <button onClick={() => { setDesktopMenu(null); toggleStarMessage(message._id, message.chatId); }} style={desktopMenuItemStyle}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={message.starredBy?.includes(user?._id) ? "#eab308" : "none"} stroke={message.starredBy?.includes(user?._id) ? "#eab308" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            {message.starredBy?.includes(user?._id) ? "Unfavorite" : "Favorite"}
                        </button>
                    )}
                    {isMe && canDelete && !isZenMode && (
                        <>
                            {isWithinEditWindow && message.type !== "voice" && (
                                <button onClick={() => { setDesktopMenu(null); onEdit(message); }} style={desktopMenuItemStyle}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    Edit
                                </button>
                            )}
                            <div style={{ height: '1px', background: 'var(--color-overlay, rgba(255, 255, 255, 0.07))', margin: '4px 8px' }} />
                            <button onClick={() => { setDesktopMenu(null); onDelete(message); }} style={{ ...desktopMenuItemStyle, color: '#f85149' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                                Delete
                            </button>
                        </>
                    )}
                </div>,
                document.body
            )}

            {/* â”€â”€ Reaction details modal â”€â”€ */}
            {showDetailsModal && createPortal(
                <div
                    className="mobile-bottom-sheet-overlay"
                    onClick={() => setShowDetailsModal(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(9, 13, 20, 0.7)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        zIndex: 9999999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div className="reactions-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="reactions-detail-header">
                            <span className="reactions-detail-title">Message Reactions</span>
                            <button className="reactions-detail-close" onClick={() => setShowDetailsModal(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
                                            onClick={() => { if (isSelf) { handleReact(r.emoji); setShowDetailsModal(false); } }}
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

