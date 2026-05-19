import { useState, useRef, useEffect, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import DecryptedText from "./DecryptedText";

const MODE_LABELS_BUBBLE = {
    instant: 'going offline',
    '1h': '1 hour',
    '8h': '8 hours',
    '24h': '1 day',
    '7d': '7 days',
};



const MessageBubble = ({ message, isMe, showAvatar, otherUser, onEdit, onDelete, onMediaClick, canDelete = true, canReply = true, zenFadeClass = "" }) => {
    const [mobileDropdown, setMobileDropdown] = useState(false);
    const [isMediaLoaded, setIsMediaLoaded] = useState(false);
    const imgRef = useRef(null);
    const user = useAuthStore((s) => s.user);
    const { toggleStarMessage, markViewOnceAsViewed } = useChatStore.getState();
    const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);
    const [manualLoad, setManualLoad] = useState(false);
    const shouldDelayLoad = isLowBandwidth && !isMe && !manualLoad;
    const status = message?.status ?? "sent";
    const progress = message?.progress ?? 0;
    const outerRef = useRef(null);

    const isViewOnce = message.isViewOnce;
    const isMediaMsg = (message.type === "image" || message.type === "video") && message.mediaUrl;
    const needsLoading = isMediaMsg && !isViewOnce && !shouldDelayLoad && status !== "sending";
    const isShown = !needsLoading || isMediaLoaded;

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
            if (e.target.closest('.mobile-bottom-sheet')) {
                return;
            }
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
        if (onMediaClick && message.mediaUrl) {
            onMediaClick(message.mediaUrl, message.type);
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
    const isMobile = window.innerWidth <= 768;

    return (
        <div
            id={`msg-${message._id}`}
            className={`message-row ${isMe ? "mine" : "theirs"} ${isNew ? "message-slide-up" : ""} ${zenFadeClass}`}
            onDoubleClick={() => !message.deletedForEveryone && canReply && onEdit({ action: "reply", ...message })}
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
                                            onMediaClick(message.mediaUrl, message.type);
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {message.disappearingMode && message.disappearingMode !== "off" && (
                                <svg
                                    width="10" height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ opacity: 0.65, flexShrink: 0 }}
                                    title={`Disappears after ${MODE_LABELS_BUBBLE[message.disappearingMode] || message.disappearingMode}`}
                                >
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            )}
                            <span className="message-time">
                                {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </span>
                    </div>

                </div>

                {!isMobile && (
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
                        {isMe && canDelete && (
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

                        {isMe && canDelete && (
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
        </div>
    );
};

export default memo(MessageBubble);