import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import { formatDistanceToNow } from "date-fns";

const MomentViewer = ({ moments, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showMusicInfo, setShowMusicInfo] = useState(false);
    const [timeLeft, setTimeLeft] = useState(10);
    const [isClosing, setIsClosing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const { viewMoment, deleteMoment } = useMomentStore();
    const { user: currentUser } = useAuthStore();
    
    const currentMoment = moments[currentIndex];

    useEffect(() => {
        if (!isOpen || !currentMoment?.music) {
            setShowMusicInfo(false);
            return;
        }
        const interval = setInterval(() => {
            setShowMusicInfo(prev => !prev);
        }, 3000);
        return () => clearInterval(interval);
    }, [isOpen, currentIndex, currentMoment?.music]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };

    const confirmDelete = async () => {
        await deleteMoment(currentMoment._id);
        setShowDeleteConfirm(false);
        if (moments.length === 1) {
            handleClose();
        } else {
            handleNext();
        }
    };

    useEffect(() => {
        if (!isOpen || !currentMoment || showDeleteConfirm) return;

        stopAudio();
        setShowMusicInfo(false);
        viewMoment(currentMoment._id, currentUser?._id);

        let totalDuration = 10;
        if (currentMoment.type === "video") {
            // Wait for metadata
        } else if (currentMoment.music) {
            totalDuration = currentMoment.music.duration || 18;
        }
        setTimeLeft(totalDuration);

        if (currentMoment.music?.previewUrl) {
            audioRef.current = new Audio(currentMoment.music.previewUrl);
            audioRef.current.currentTime = currentMoment.music.startTime || 0;
            audioRef.current.muted = isMuted;
            audioRef.current.play().catch(e => console.log("Audio blocked"));
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
        }, 1000);
    };

    if (!isOpen || !currentMoment) return null;

    const user = currentMoment.userId;
    const isOnlyMusic = currentMoment.type === "music" && !currentMoment.mediaUrl;
    const isOwn = (user?._id || user) === currentUser?._id;

    return createPortal(
        <div className={`modal-overlay moments-aura-viewer-overlay ${isClosing ? 'fading-out' : ''}`}>
            <div className="moments-aura-viewer-content" onClick={(e) => e.stopPropagation()}>
                <div className="aura-progress-bars">
                    {moments.map((_, idx) => (
                        <div key={idx} className="aura-progress-bg">
                            <div className={`aura-progress-fill solid ${idx === currentIndex ? 'active' : (idx < currentIndex ? 'completed' : '')}`} />
                        </div>
                    ))}
                </div>

                <div className="aura-viewer-header">
                    <div className="aura-user-meta-container">
                        <div className="aura-user-meta">
                            <div className="avatar avatar-md moments-halo">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt={user.username} />
                                ) : (
                                    <span>{user?.username?.slice(0, 2).toUpperCase()}</span>
                                )}
                            </div>
                            <div className="aura-user-info">
                                <span className="aura-username">{user?.username}</span>
                                <div className="aura-metadata-wrapper">
                                    <span className={`aura-time ${showMusicInfo ? 'fade-out' : 'fade-in'}`}>
                                        {formatDistanceToNow(new Date(currentMoment.createdAt), { addSuffix: true })}
                                    </span>
                                    {currentMoment.music && (
                                        <span className={`aura-music-line ${showMusicInfo ? 'fade-in' : 'fade-out'}`}>
                                            vibe. {currentMoment.music.title}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="aura-avatar-countdown">{Math.ceil(timeLeft)}</div>
                    </div>
                    
                    <div className="aura-viewer-actions">
                        {isOwn && (
                            <button className="aura-trash-btn" onClick={() => setShowDeleteConfirm(true)} title="Let go.">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </button>
                        )}
                        {(currentMoment.type === "video" || currentMoment.music) && (
                            <button className="aura-speaker-btn" onClick={() => setIsMuted(!isMuted)}>
                                {isMuted ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                )}
                            </button>
                        )}
                        <button className="aura-viewer-close" onClick={handleClose}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    ) : currentMoment.mediaUrl ? (
                        <img src={currentMoment.mediaUrl} alt="Moment" className="viewer-main-media" />
                    ) : (
                        <div className="aura-text-only-bg">
                            {isOnlyMusic && (
                                <div className="aura-music-focus">
                                    <img src={currentMoment.music.coverUrl} alt="Art" className="focus-art" />
                                    <div className="music-visualizer centered">
                                        <div className="v-bar"></div>
                                        <div className="v-bar"></div>
                                        <div className="v-bar"></div>
                                        <div className="v-bar"></div>
                                        <div className="v-bar"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="aura-content-overlay">
                        {isOnlyMusic ? (
                            <div className="music-focus-info">
                                <h2>{currentMoment.music.title}</h2>
                                <p>{currentMoment.music.artist}</p>
                            </div>
                        ) : currentMoment.music && (
                            <div className="aura-music-tag">
                                <div className="music-visualizer">
                                    <div className="v-bar"></div>
                                    <div className="v-bar"></div>
                                    <div className="v-bar"></div>
                                </div>
                                <div className="music-meta">
                                    <span className="m-title">{currentMoment.music.title}</span>
                                    <span className="m-artist">{currentMoment.music.artist}</span>
                                </div>
                            </div>
                        )}
                        {currentMoment.content && (
                            <p className="aura-text-content">{currentMoment.content}</p>
                        )}
                    </div>
                </div>

                <div className="aura-nav-zone left" onClick={handlePrev} />
                <div className="aura-nav-zone right" onClick={handleNext} />
                
                {showDeleteConfirm && (
                    <div className="aura-permission-popup">
                        <h3>Let go?</h3>
                        <p>This #moment. will fade for everyone, forever.</p>
                        <div className="permission-actions">
                            <button className="deny-btn" onClick={confirmDelete} style={{ background: '#ef4444', border: 'none' }}>Let go</button>
                            <button className="allow-btn" onClick={() => setShowDeleteConfirm(false)} style={{ background: 'rgba(255,255,255,0.1)' }}>Keep</button>
                        </div>
                    </div>
                )}

                <div className="aura-viewer-footer-wrapper">
                    <div className="aura-viewer-footer">#moments.</div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentViewer);
