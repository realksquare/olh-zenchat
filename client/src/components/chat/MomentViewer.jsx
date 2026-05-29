import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import { formatDistanceToNow } from "date-fns";
import { getAudioContext } from "../../utils/audio";
import { getProxyAudioUrl } from "../../utils/musicProxy";

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

    const [totalDuration, setTotalDuration] = useState(10);

    const audioRef = useRef(null);
    const videoRef = useRef(null);
    
    const locationContainerRef = useRef(null);
    const locationContentRef = useRef(null);
    const [locMarqueeDist, setLocMarqueeDist] = useState(0);

    // Make the viewer reactive by pulling the latest moments for this user
    const allMoments = useMomentStore((s) => s.moments);
    const currentUserId = useAuthStore((s) => s.user?._id);

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


    useEffect(() => {
        if (!isOpen || !currentMoment || showDeleteConfirm) return;

        stopAudio();
        setShowMusicInfo(false);
        useMomentStore.getState().viewMoment(currentMoment._id, currentUserId);

        let duration = 10;
        if (currentMoment.type === "video") {
            // Will be updated by onLoadedMetadata
        } else if (currentMoment.music && currentMoment.music.duration) {
            duration = currentMoment.music.duration;
        }
        setTotalDuration(duration);
        setTimeLeft(duration);

        if (currentMoment.music?.previewUrl) {
            const previewUrl = currentMoment.music.previewUrl;
            const startTime = currentMoment.music.startTime || 0;
            const proxiedUrl = getProxyAudioUrl(previewUrl);
            const audio = new Audio(proxiedUrl);
            audio.muted = isMuted;
            audio.preload = 'auto';
            // Set seek position when metadata is ready (don't call play from here — blocked on mobile)
            audio.addEventListener("loadedmetadata", () => {
                if (startTime) audio.currentTime = startTime;
            });
            audio.addEventListener("error", (e) => {
                console.warn("Moment audio load error:", e.target?.error?.message || e);
            });
            audio.load();
            audioRef.current = audio;
            // Attempt immediate play - works on desktop, silently fails on mobile (retried by triggerUnlockPlay)
            audio.play().catch(() => {});
        }

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    handleNext();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(interval);
            stopAudio();
        };
    }, [currentIndex, isOpen, currentMoment?._id, showDeleteConfirm]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.muted = isMuted;
        if (videoRef.current) videoRef.current.muted = isMuted;
    }, [isMuted]);

    const triggerUnlockPlay = () => {
        try {
            const ctx = getAudioContext();
            if (ctx && ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }
        } catch (err) {}

        if (!isMuted) {
            if (audioRef.current) {
                // If the audio element errored out, recreate it fresh
                if (audioRef.current.error && currentMoment?.music?.previewUrl) {
                    const newAudio = new Audio(getProxyAudioUrl(currentMoment.music.previewUrl));
                    newAudio.muted = false;
                    if (currentMoment.music?.startTime) newAudio.currentTime = currentMoment.music.startTime;
                    audioRef.current = newAudio;
                }
                if (!audioRef.current.error) {
                    audioRef.current.play().catch(e => {
                        console.log("Audio play failed on unlock:", e);
                    });
                }
            }
            if (videoRef.current) {
                videoRef.current.play().catch(e => {
                    console.log("Video play failed on unlock:", e);
                });
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
                                            if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
                                            if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
                                            return `${Math.floor(diff/86400)}d ago`;
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
                        <div className="aura-media-content" key={currentMoment._id}>
                            <img 
                                src={currentMoment.mediaUrl} 
                                alt="Moment" 
                                className="viewer-main-media" 
                                style={FILTER_STYLES[currentMoment.filter] || FILTER_STYLES.none}
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
                        <p>This #moment. will fade for everyone.</p>
                        <div className="permission-actions">
                            <button className="deny-btn" onClick={(e) => { e.stopPropagation(); confirmDelete(); }}>Let go...</button>
                            <button className="allow-btn" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}>Keep</button>
                        </div>
                    </div>
                )}

                {/* Like button — non-owners can like; owner sees count */}
                {(() => {
                    const likes = currentMoment.likes || [];
                    const likeCount = likes.length;
                    const hasLiked = likes.some(id => id?.toString() === currentUserId?.toString());
                    return (
                        <div
                            className={`aura-like-pill ${isOwn ? 'aura-like-pill--owner' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {isOwn ? (
                                /* Owner: read-only like count display */
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill={likeCount > 0 ? "#f43f5e" : "none"} stroke={likeCount > 0 ? "#f43f5e" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                    </svg>
                                    <span className="aura-like-count">{likeCount}</span>
                                </>
                            ) : (
                                /* Viewer: toggleable like button */
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
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={hasLiked ? "#f43f5e" : "none"} stroke={hasLiked ? "#f43f5e" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aura-heart-icon">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                    </svg>
                                    {likeCount > 0 && <span className="aura-like-count">{likeCount}</span>}
                                </button>
                            )}
                        </div>
                    );
                })()}

                <div className="aura-viewer-footer-wrapper">
                    <div className="aura-viewer-footer">#moments. - powered by OLH ZenChat.</div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentViewer);
