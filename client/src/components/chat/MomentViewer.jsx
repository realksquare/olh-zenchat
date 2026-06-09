import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { useSocket } from "../../context/SocketContext";
import { formatDistanceToNow } from "date-fns";
import { getAudioContext } from "../../utils/audio";
import axiosInstance from "../../utils/axios";

const FILTER_STYLES = {
    none: {},
    warm: { filter: "sepia(0.3) saturate(1.2) contrast(1.1)" },
    cold: { filter: "hue-rotate(180deg) saturate(1.1) contrast(1.05)" },
    vivid: { filter: "saturate(1.6) contrast(1.15)" },
    fade: { filter: "brightness(1.1) contrast(0.95) saturate(0.9)" },
    bw: { filter: "grayscale(1) contrast(1.2)" }
};

const MomentViewer = ({ moments: initialMoments, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(10);
    const [isClosing, setIsClosing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showMusicInfo, setShowMusicInfo] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [likeLoading, setLikeLoading] = useState(false);
    const [isResharing, setIsResharing] = useState(false);
    const [reshared, setReshared] = useState(false);
    const [isMomentMediaLoaded, setIsMomentMediaLoaded] = useState(false);

    const [totalDuration, setTotalDuration] = useState(10);
    const [replyText, setReplyText] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const { sendMessage, showZenToast } = useSocket();

    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const isInputFocusedRef = useRef(false);
    isInputFocusedRef.current = isInputFocused;

    const locationContainerRef = useRef(null);
    const locationContentRef = useRef(null);
    const [locMarqueeDist, setLocMarqueeDist] = useState(0);

    // Make the viewer reactive by pulling the latest moments for this user
    const allMoments = useMomentStore((s) => s.moments);
    const currentUserId = useAuthStore((s) => s.user?._id);
    const isZenMode = useChatStore((s) => s.isZenMode);
    const zenUsers = useChatStore((s) => s.zenUsers);

    const moments = useMemo(() => {
        if (!initialMoments || initialMoments.length === 0) return [];
        // Cast to string to avoid object comparison issues
        const targetUserId = (initialMoments[0].userId?._id || initialMoments[0].userId)?.toString();
        if (!targetUserId) return initialMoments; // Fallback to initial if ID extraction fails

        const filtered = allMoments.filter(m => (m.userId?._id || m.userId)?.toString() === targetUserId);
        return filtered.length > 0 ? filtered : initialMoments;
    }, [allMoments, initialMoments]);

    const currentMoment = moments[currentIndex];

    useEffect(() => {
        setIsMomentMediaLoaded(false);
    }, [currentIndex, currentMoment?._id]);

    useEffect(() => {
        const measure = () => {
            if (!locationContainerRef.current || !locationContentRef.current) {
                setLocMarqueeDist(0);
                return;
            }
            const contentWidth = locationContentRef.current.scrollWidth;
            const containerWidth = locationContentRef.current.parentElement.offsetWidth;
            const scrollDist = contentWidth - containerWidth;
            setLocMarqueeDist(scrollDist > 0 ? -(scrollDist + 10) : 0);
        };

        if (isOpen && currentMoment?.locationTag) {
            const timer = setTimeout(measure, 150);
            return () => clearTimeout(timer);
        } else {
            setLocMarqueeDist(0);
        }
    }, [currentMoment?.locationTag, currentIndex, isOpen]);

    // Handle array shrinking (deletion)
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            // Only close if we had moments and they were all removed
            // We check allMoments.length to ensure we don't close prematurely during sync
            if (moments.length === 0) {
                onClose();
            } else if (currentIndex >= moments.length && moments.length > 0) {
                setCurrentIndex(moments.length - 1);
            }
        }
    }, [moments.length, isOpen, currentIndex, onClose]);

    useEffect(() => {
        if (isOpen && moments.length > 0) {
            const targetUserId = (moments[0].userId?._id || moments[0].userId)?.toString();
            const isOwn = targetUserId === currentUserId?.toString();
            if (!isOwn) {
                const isOtherInZen = targetUserId && (zenUsers[targetUserId] || zenUsers[targetUserId.toString()]);
                if (isZenMode || isOtherInZen) {
                    onClose();
                }
            }
        }
    }, [isOpen, isZenMode, zenUsers, moments, currentUserId, onClose]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };

    useEffect(() => {
        if (!isOpen || !currentMoment?.music) {
            setShowMusicInfo(false);
            return;
        }
        const interval = setInterval(() => {
            setShowMusicInfo(prev => !prev);
        }, 5000);
        return () => clearInterval(interval);
    }, [isOpen, currentIndex, currentMoment?.music]);

    const confirmDelete = async (e) => {
        if (e) e.stopPropagation();
        if (!currentMoment) return;
        setIsDeleting(true);
        try {
            const idToDelete = currentMoment._id;
            if (moments.length === 1) {
                handleClose();
                setTimeout(() => useMomentStore.getState().deleteMoment(idToDelete), 500);
            } else {
                await useMomentStore.getState().deleteMoment(idToDelete);
                setShowDeleteConfirm(false);
            }
        } catch (err) {
            console.error("Delete failed:", err);
            setShowDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
        }
    };


    // Duration and time reset when moment changes
    useEffect(() => {
        if (isOpen && currentMoment) {
            let duration = 10;
            if (currentMoment.type === "video") {
                // Will be updated by onLoadedMetadata
            } else if (currentMoment.music && currentMoment.music.duration) {
                duration = currentMoment.music.duration;
            }
            setTotalDuration(duration);
            setTimeLeft(duration);
        }
    }, [currentIndex, isOpen, currentMoment?._id]);

    // Timer effect that respects input focus (pausing)
    useEffect(() => {
        if (!isOpen || !currentMoment || showDeleteConfirm) return;

        stopAudio();
        setShowMusicInfo(false);
        useMomentStore.getState().viewMoment(currentMoment._id, currentUserId);

        if (currentMoment.music?.trackId || currentMoment.music?.previewUrl || currentMoment.music?.title) {
            let cancelled = false;
            const startTime = currentMoment.music.startTime || 0;

            const setupAudio = async () => {
                let cancelled = false;

                const playUrl = (url) => {
                    const audio = new Audio(url);
                    audio.muted = isMuted;
                    audio.preload = 'auto';
                    audio.addEventListener("loadedmetadata", () => {
                        if (startTime) audio.currentTime = startTime;
                    });

                    audio.addEventListener("error", async (e) => {
                        console.warn("Moment audio load error:", e.target?.error?.message || e);
                        if (!cancelled && url === currentMoment.music.previewUrl) {
                            await fetchAndPlay();
                        }
                    });

                    audio.load();
                    audioRef.current = audio;
                    audio.play().catch(() => { });
                };

                const fetchAndPlay = async () => {
                    let freshUrl = null;
                    if (currentMoment.music.trackId) {
                        try {
                            const res = await axiosInstance.get(`/music/preview?id=${encodeURIComponent(currentMoment.music.trackId)}`);
                            if (res.data?.previewUrl) freshUrl = res.data.previewUrl;
                        } catch { }
                    }
                    if (!freshUrl && currentMoment.music.title) {
                        const q = [currentMoment.music.title, currentMoment.music.artist].filter(Boolean).join(' ');
                        try {
                            const res = await axiosInstance.get(`/music/preview?q=${encodeURIComponent(q)}`);
                            if (res.data?.previewUrl) freshUrl = res.data.previewUrl;
                        } catch { }
                    }
                    if (freshUrl && !cancelled) {
                        playUrl(freshUrl);
                    }
                };

                if (currentMoment.music.previewUrl) {
                    const cachedUrl = currentMoment.music.previewUrl.replace(/^http:\/\//i, 'https://');
                    playUrl(cachedUrl);
                } else {
                    await fetchAndPlay();
                }
            };

            setupAudio();

            const interval = setInterval(() => {
                if (isInputFocusedRef.current) return;
                setTimeLeft(prev => {
                    if (prev <= 1) { clearInterval(interval); handleNext(); return 0; }
                    return prev - 1;
                });
            }, 1000);

            return () => {
                cancelled = true;
                clearInterval(interval);
                stopAudio();
            };
        }

        const interval = setInterval(() => {
            if (isInputFocusedRef.current) return;
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(interval); handleNext(); return 0; }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(interval);
            stopAudio();
        };
    }, [currentIndex, isOpen, currentMoment?._id, showDeleteConfirm]);

    // Handle audio/video pausing while user is typing a reply
    useEffect(() => {
        if (videoRef.current) {
            if (isInputFocused) {
                videoRef.current.pause();
            } else {
                videoRef.current.play().catch(() => { });
            }
        }
        if (audioRef.current) {
            if (isInputFocused) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(() => { });
            }
        }
    }, [isInputFocused]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.muted = isMuted;
        if (videoRef.current) videoRef.current.muted = isMuted;
    }, [isMuted]);

    const triggerUnlockPlay = () => {
        try {
            const ctx = getAudioContext();
            if (ctx && ctx.state === "suspended") ctx.resume().catch(() => { });
        } catch (err) { }

        if (!isMuted) {
            if (audioRef.current && !audioRef.current.error) {
                audioRef.current.play().catch(() => { });
            }
            if (videoRef.current) {
                videoRef.current.play().catch(() => { });
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            window.addEventListener("click", triggerUnlockPlay);
            window.addEventListener("touchstart", triggerUnlockPlay);
        }
        return () => {
            window.removeEventListener("click", triggerUnlockPlay);
            window.removeEventListener("touchstart", triggerUnlockPlay);
        };
    }, [currentIndex, isOpen, isMuted]);

    const handleNext = () => {
        if (currentIndex < moments.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            handleClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        stopAudio();
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setCurrentIndex(0);
            setShowDeleteConfirm(false);
        }, 800);
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || isSendingReply) return;
        setIsSendingReply(true);
        try {
            const targetUserId = (currentMoment.userId?._id || currentMoment.userId)?.toString();
            if (!targetUserId) return;

            // Fetch or create the chat session
            const { data } = await axiosInstance.post("/chats", { userId: targetUserId });
            const chatId = data.chat._id;

            // Send the reply message with moment context attached
            const targetUsername = currentMoment.userId?.username || "";
            await sendMessage(chatId, replyText, "text", "", null, false, null, false, "", currentMoment, targetUsername);

            setReplyText("");
            setIsInputFocused(false);
            showZenToast("success", "Reply sent via DM!");
        } catch (err) {
            console.error("Failed to send reply:", err);
        } finally {
            setIsSendingReply(false);
        }
    };

    const handleReshare = async () => {
        if (isResharing || reshared || !currentMoment) return;
        setIsResharing(true);
        try {
            await axiosInstance.post(`/moments/${currentMoment._id}/reshare`);
            setReshared(true);
            await useMomentStore.getState().fetchMoments();
            showZenToast("success", "Moment reshared to your feed!");
        } catch (err) {
            const msg = err.response?.data?.message;
            if (err.response?.status === 409) {
                showZenToast("info", "You have already reshared this moment");
                setReshared(true);
            } else {
                showZenToast("error", msg || "Could not reshare. Try again.");
            }
        } finally {
            setIsResharing(false);
        }
    };

    const isTaggedUser = useMemo(() => {
        if (!currentMoment || !currentMoment.taggedUsers || !currentUserId) return false;
        return currentMoment.taggedUsers.some(u => (u._id || u)?.toString() === currentUserId?.toString());
    }, [currentMoment, currentUserId]);

    const haloColor = useMemo(() => {
        if (!currentMoment?.userId) return "#082f49";
        return useMomentStore.getState().getHaloColor(currentMoment.userId, currentUserId);
    }, [currentMoment, currentUserId]);

    if (!isOpen || !currentMoment) return null;

    const user = currentMoment.userId;
    // Fix display logic: media should ALWAYS show if mediaUrl exists
    const hasMedia = !!currentMoment.mediaUrl;
    const hasText = !!currentMoment.content;
    const isOwn = (user?._id || user) === currentUserId;

    const bgStyle = (currentMoment.music?.coverUrl && !hasMedia) ? {
        '--vibe-bg': `url(${currentMoment.music.coverUrl})`,
        background: `linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.4)), url(${currentMoment.music.coverUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    } : {};

    const songMetadata = currentMoment.music ? `${currentMoment.music.title} • ${currentMoment.music.artist}` : "";
    const isLongMetadata = songMetadata.length > 20;

    return createPortal(
        <div className={`modal-overlay moments-aura-viewer-overlay ${isClosing ? 'fading-out' : ''}`} onClick={triggerUnlockPlay} onTouchStart={triggerUnlockPlay}>
            <div className="moments-aura-viewer-content" onClick={(e) => { e.stopPropagation(); triggerUnlockPlay(); }} onTouchStart={triggerUnlockPlay} style={bgStyle}>
                {currentMoment.mediaUrl && (
                    <div
                        className="aura-blur-backdrop"
                        style={{ backgroundImage: `url(${currentMoment.mediaUrl})` }}
                    />
                )}
                <div className="aura-progress-bars" style={{ display: 'flex', gap: '4px', position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 1100 }}>
                    {moments.map((_, idx) => (
                        <div key={`${currentIndex}-${idx}`} className="aura-progress-bg" style={{ flex: 1, height: '3px', background: 'rgba(255, 255, 255, 0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div
                                className={`aura-progress-fill solid ${idx === currentIndex ? 'active' : (idx < currentIndex ? 'completed' : '')}`}
                                style={{
                                    ...(idx === currentIndex ? { '--duration': `${totalDuration}s` } : {}),
                                    background: '#ffffff',
                                    height: '100%',
                                    width: idx < currentIndex ? '100%' : (idx === currentIndex ? undefined : '0%'), // Let CSS animation handle current, force 100% for completed
                                    opacity: 1,
                                    boxShadow: 'none' // Remove any blur
                                }}
                            />
                        </div>
                    ))}
                </div>

                <div className={`aura-viewer-header${(!hasMedia) ? ' with-bg' : ' with-gradient'}`}>
                    <div className="aura-user-meta-container">
                        <div className="aura-user-meta">
                            <div className="avatar-aura-wrap">
                                <div className="avatar avatar-md moments-aura" style={{ '--aura-color': haloColor }}>
                                    {user?.avatar ? (
                                        <img src={user.avatar} alt={user.username} />
                                    ) : (
                                        <span>{user?.username?.slice(0, 2).toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="aura-avatar-countdown">{Math.ceil(timeLeft)}</div>
                            </div>
                            <div className="aura-user-info">
                                <div className="aura-user-title-row">
                                    <span className="aura-username">{user?.username}</span>

                                    <span className="aura-moment-counter">
                                        {currentIndex + 1}/{moments.length}
                                    </span>
                                </div>
                                <div className="aura-metadata-wrapper">
                                    <span className={`aura-time ${showMusicInfo ? 'fade-out' : 'fade-in'}`}>
                                        {(() => {
                                            const diff = Math.floor((Date.now() - new Date(currentMoment.createdAt).getTime()) / 1000);
                                            if (diff < 60) return 'Just now';
                                            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                                            return `${Math.floor(diff / 86400)}d ago`;
                                        })()}
                                    </span>
                                    {currentMoment.music && (
                                        <div className={`aura-music-line ${showMusicInfo ? 'fade-in' : 'fade-out'}`}>
                                            <div className={isLongMetadata ? "marquee-text" : ""}>
                                                {songMetadata}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {currentMoment.locationTag && (
                                    <div className="aura-header-location" ref={locationContainerRef}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '4px' }}>
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span className="aura-header-location-text">
                                            <span
                                                ref={locationContentRef}
                                                className={`aura-header-location-content ${locMarqueeDist < 0 ? "marquee-bidirectional" : ""}`}
                                                style={locMarqueeDist < 0 ? { "--marquee-dist": `${locMarqueeDist}px` } : {}}
                                            >
                                                {currentMoment.locationTag}
                                            </span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="aura-header-right">
                        <div className="aura-viewer-actions">
                            {isOwn && (
                                <div className="aura-view-counter" title="Views">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{useMomentStore.getState().getViewCount(currentMoment._id, currentMoment.userId)}</span>
                                </div>
                            )}

                            {(isOwn || currentMoment.type === "video" || currentMoment.music) && (
                                <div className="aura-menu-container" style={{ position: 'relative' }}>
                                    <button className="aura-menu-trigger" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                            <circle cx="12" cy="12" r="1" />
                                            <circle cx="12" cy="5" r="1" />
                                            <circle cx="12" cy="19" r="1" />
                                        </svg>
                                    </button>
                                    {showMenu && (
                                        <div className="aura-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                            {(currentMoment.type === "video" || currentMoment.music) && (
                                                <button className="aura-dropdown-item" onClick={() => { setIsMuted(!isMuted); setShowMenu(false); }}>
                                                    {isMuted ? (
                                                        <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg> Unmute Audio</>
                                                    ) : (
                                                        <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg> Mute Audio</>
                                                    )}
                                                </button>
                                            )}
                                            {isOwn && (
                                                <button className="aura-dropdown-item danger" onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }} disabled={isDeleting}>
                                                    {isDeleting ? <div className="aura-mini-spinner" /> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> Delete Moment</>}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button className="aura-viewer-close" onClick={handleClose}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="aura-viewer-media">
                    {currentMoment.type === "video" ? (
                        <video
                            ref={videoRef}
                            src={currentMoment.mediaUrl}
                            autoPlay
                            muted={isMuted}
                            playsInline
                            onLoadedMetadata={(e) => {
                                const dur = Math.ceil(e.target.duration);
                                setTotalDuration(dur);
                                setTimeLeft(dur);
                            }}
                        />
                    ) : hasMedia ? (
                        <div className="aura-media-content" key={currentMoment._id} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                            {currentMoment.lqip && !isMomentMediaLoaded && (
                                <img
                                    src={currentMoment.lqip}
                                    alt="placeholder"
                                    className="viewer-main-media"
                                    style={{
                                        position: 'absolute',
                                        filter: 'blur(12px) brightness(0.8)',
                                        transform: 'scale(1.05)',
                                        zIndex: 1
                                    }}
                                />
                            )}
                            <img
                                src={currentMoment.mediaUrl}
                                alt="Moment"
                                className="viewer-main-media"
                                onLoad={() => setIsMomentMediaLoaded(true)}
                                style={{
                                    ...(FILTER_STYLES[currentMoment.filter] || FILTER_STYLES.none),
                                    opacity: isMomentMediaLoaded ? 1 : (currentMoment.lqip ? 0 : 1),
                                    transition: 'opacity 0.4s ease-in-out',
                                    position: 'relative',
                                    zIndex: 2
                                }}
                            />

                            {currentMoment.caption && currentMoment.caption.trim().length >= 3 && (
                                <div className="aura-image-caption-pill">
                                    {currentMoment.caption}
                                </div>
                            )}
                            {hasText && (
                                <div className="aura-content-overlay">
                                    <p className="aura-overlay-text">{currentMoment.content}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="aura-text-only-bg">
                            {currentMoment.music && !hasText && (
                                <div className="aura-music-focus">
                                    <img src={currentMoment.music.coverUrl} alt="Art" className="focus-art" />
                                    <div className="music-visualizer centered">
                                        <div className="v-bar"></div><div className="v-bar"></div><div className="v-bar"></div><div className="v-bar"></div><div className="v-bar"></div>
                                    </div>
                                    <div className="music-focus-info">
                                        <h2>{currentMoment.music.title}</h2>
                                        <p>{currentMoment.music.artist}</p>
                                    </div>
                                </div>
                            )}
                            {hasText && (
                                <p className="aura-text-content centered">{currentMoment.content}</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="aura-nav-zone left" onClick={handlePrev} />
                <div className="aura-nav-zone right" onClick={handleNext} />

                {showDeleteConfirm && (
                    <div className="aura-permission-popup">
                        <h3>Let go?</h3>
                        <p>This #Moment will fade for everyone...</p>
                        <div className="permission-actions">
                            <button className="deny-btn" onClick={(e) => { e.stopPropagation(); confirmDelete(); }}>Let go...</button>
                            <button className="allow-btn" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}>Keep</button>
                        </div>
                    </div>
                )}



                {/* Like button or Reply bar integration */}
                {(() => {
                    const likes = currentMoment.likes || [];
                    const likeCount = likes.length;
                    const hasLiked = likes.some(id => id?.toString() === currentUserId?.toString());

                    if (isOwn) {
                        return (
                            <div
                                className="aura-like-pill aura-like-pill--owner"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill={likeCount > 0 ? "#f43f5e" : "none"} stroke={likeCount > 0 ? "#f43f5e" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                                <span className="aura-like-count">{likeCount}</span>
                            </div>
                        );
                    }

                    return (
                        <div className="aura-reply-container" onClick={(e) => e.stopPropagation()}>
                            <div className="aura-reply-input-wrapper">
                                <input
                                    type="text"
                                    className="aura-reply-input"
                                    placeholder="Reply to moment..."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onFocus={() => setIsInputFocused(true)}
                                    onBlur={() => setIsInputFocused(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSendReply();
                                    }}
                                    disabled={isSendingReply}
                                />

                                {replyText.trim() && (
                                    <button
                                        className="aura-reply-send-btn"
                                        onClick={handleSendReply}
                                        disabled={isSendingReply}
                                        style={{ marginRight: '6px' }}
                                    >
                                        {isSendingReply ? (
                                            <div className="aura-mini-spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'aura-spin 0.8s linear infinite' }} />
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="22" y1="2" x2="11" y2="13" />
                                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                            </svg>
                                        )}
                                    </button>
                                )}

                                {/* Reshare button - only for tagged users */}
                                {isTaggedUser && (
                                    <button
                                        className={`aura-reshare-btn ${reshared ? 'reshared' : ''} ${isResharing ? 'loading' : ''}`}
                                        disabled={isResharing || reshared}
                                        onClick={(e) => { e.stopPropagation(); handleReshare(); }}
                                        title={reshared ? "Already reshared" : "Reshare to your feed"}
                                    >
                                        {isResharing ? (
                                            <div className="aura-mini-spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'aura-spin 0.8s linear infinite' }} />
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="17 1 21 5 17 9" />
                                                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                                <polyline points="7 23 3 19 7 15" />
                                                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                            </svg>
                                        )}
                                    </button>
                                )}

                                <button
                                    className={`aura-like-btn ${hasLiked ? 'liked' : ''} ${likeLoading ? 'loading' : ''}`}
                                    disabled={likeLoading}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (likeLoading) return;
                                        setLikeLoading(true);
                                        await useMomentStore.getState().likeMoment(currentMoment._id);
                                        setLikeLoading(false);
                                    }}
                                    title={hasLiked ? "Unlike" : "Like"}
                                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={hasLiked ? "#f43f5e" : "none"} stroke={hasLiked ? "#f43f5e" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aura-heart-icon">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentViewer);
