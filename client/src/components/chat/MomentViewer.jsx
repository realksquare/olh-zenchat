import { useState, useEffect, useRef, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import { formatDistanceToNow } from "date-fns";

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

    const [totalDuration, setTotalDuration] = useState(10);

    const audioRef = useRef(null);
    const videoRef = useRef(null);
    
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
            audioRef.current = new Audio(currentMoment.music.previewUrl);
            audioRef.current.currentTime = currentMoment.music.startTime || 0;
            audioRef.current.muted = isMuted;
            audioRef.current.play().catch(e => {});
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

    const bgStyle = currentMoment.music?.coverUrl ? {
        '--vibe-bg': `url(${currentMoment.music.coverUrl})`,
        background: `linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.4)), url(${currentMoment.music.coverUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    } : {};

    const songMetadata = currentMoment.music ? `${currentMoment.music.title} • ${currentMoment.music.artist}` : "";
    const isLongMetadata = songMetadata.length > 20;

    return createPortal(
        <div className={`modal-overlay moments-aura-viewer-overlay ${isClosing ? 'fading-out' : ''}`}>
            <div className="moments-aura-viewer-content" onClick={(e) => e.stopPropagation()} style={bgStyle}>
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
                                        {formatDistanceToNow(new Date(currentMoment.createdAt), { addSuffix: true })}
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
                                    <div className="aura-header-location">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '3px' }}>
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span className="aura-header-location-text">
                                            {currentMoment.locationTag}
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

                <div className="aura-viewer-footer-wrapper">
                    <div className="aura-viewer-footer">#moments. - powered by OLH ZenChat.</div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentViewer);
