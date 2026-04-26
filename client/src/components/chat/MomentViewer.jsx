import { useState, useEffect, useRef, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import { formatDistanceToNow } from "date-fns";

const MomentViewer = ({ moments: initialMoments, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(10);
    const [isClosing, setIsClosing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showMusicInfo, setShowMusicInfo] = useState(false);
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    
    // Make the viewer reactive by pulling the latest moments for this user
    const allMoments = useMomentStore((s) => s.moments);
    const { viewMoment, deleteMoment, getHaloColor } = useMomentStore();
    const { user: currentUser } = useAuthStore();

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
            // Only close if we had moments and they were all removed
            // We check allMoments.length to ensure we don't close prematurely during sync
            if (moments.length === 0 && allMoments.length > 0) {
                onClose();
            } else if (currentIndex >= moments.length && moments.length > 0) {
                setCurrentIndex(moments.length - 1);
            }
        }
    }, [moments.length, allMoments.length, isOpen, currentIndex, onClose]);


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
        await deleteMoment(currentMoment._id);
        setShowDeleteConfirm(false);
        // The useEffect will automatically handle out-of-bounds or closing the viewer.
    };


    useEffect(() => {
        if (!isOpen || !currentMoment || showDeleteConfirm) return;

        stopAudio();
        setShowMusicInfo(false);
        viewMoment(currentMoment._id, currentUser?._id);

        let totalDuration = 10;
        if (currentMoment.type === "video") {
            // Placeholder, will be updated by onLoadedMetadata
        } else if (currentMoment.music && currentMoment.music.duration) {
            totalDuration = currentMoment.music.duration;
        }
        setTimeLeft(totalDuration);

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
        return getHaloColor(currentMoment.userId, currentUser?._id);
    }, [currentMoment, getHaloColor, currentUser?._id]);

    if (!isOpen || !currentMoment) return null;

    const user = currentMoment.userId;
    // Fix display logic: media should ALWAYS show if mediaUrl exists
    const hasMedia = !!currentMoment.mediaUrl;
    const hasText = !!currentMoment.content;
    const isOwn = (user?._id || user) === currentUser?._id;

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
                <div className="aura-progress-bars">
                    {moments.map((_, idx) => (
                        <div key={`${currentIndex}-${idx}`} className="aura-progress-bg">
                            <div 
                                className={`aura-progress-fill solid ${idx === currentIndex ? 'active' : (idx < currentIndex ? 'completed' : '')}`} 
                                style={idx === currentIndex ? { '--duration': `${currentMoment.music?.duration || 10}s` } : {}}
                            />
                        </div>
                    ))}
                </div>

                <div className={`aura-viewer-header ${(!hasMedia) ? 'with-bg' : ''}`}>
                    <div className="aura-user-meta-container">
                        <div className="aura-user-meta">
                            <div className="avatar-with-countdown">
                                <div className="avatar avatar-md moments-halo" style={{ '--halo-color': haloColor }}>
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
                                        {currentIndex + 1} of {moments.length}
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
                            </div>
                        </div>
                    </div>
                    <div className="aura-header-right">
                        <div className="aura-viewer-actions">
                            {isOwn && (
                                <div className="aura-view-counter" title="Views">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    <span style={{ fontSize: '1rem', fontWeight: '700' }}>{currentMoment.views?.length || 0}</span>
                                </div>
                            )}
                            {isOwn && (
                                <button className="aura-trash-btn" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} title="Let go." style={{ zIndex: 100, padding: '8px' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                </button>
                            )}
                            {(currentMoment.type === "video" || currentMoment.music) && (
                                <button className="aura-speaker-btn" onClick={() => setIsMuted(!isMuted)} style={{ padding: '8px' }}>
                                    {isMuted ? (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                                    )}
                                </button>
                            )}
                        </div>

                        <button className="aura-viewer-close" onClick={handleClose} style={{ padding: '8px' }}>
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
                            onLoadedMetadata={(e) => setTimeLeft(Math.ceil(e.target.duration))}
                        />
                    ) : hasMedia ? (
                        <div className="aura-media-content" key={currentMoment._id}>
                            <img src={currentMoment.mediaUrl} alt="Moment" className="viewer-main-media" />
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
                            <button className="deny-btn" onClick={(e) => { e.stopPropagation(); confirmDelete(); }} style={{ background: '#ef4444', border: 'none', zIndex: 100, padding: '12px 20px', fontSize: '1rem', fontWeight: '700' }}>Let go...</button>
                            <button className="allow-btn" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }} style={{ background: 'rgba(255,255,255,0.1)', zIndex: 100, padding: '12px 20px', fontSize: '1rem' }}>Keep</button>
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
