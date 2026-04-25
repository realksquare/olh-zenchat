import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import { formatDistanceToNow } from "date-fns";

const MomentViewer = ({ moments, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showMusicInfo, setShowMusicInfo] = useState(false);
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const { viewMoment } = useMomentStore();
    const { user: currentUser } = useAuthStore();
    
    const currentMoment = moments[currentIndex];

    // Handle Metadata Rotation (Crossfade)
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

    // Cleanup Audio on unmount or slide change
    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };

    useEffect(() => {
        if (!isOpen || !currentMoment) return;

        // Reset state for new moment
        stopAudio();
        setShowMusicInfo(false);

        // Mark as viewed
        viewMoment(currentMoment._id, currentUser?._id);

        // Calculate Duration
        let totalDuration = 10; // Default for text/image
        if (currentMoment.type === "video") {
            // Video duration will be handled by onLoadedMetadata
        } else if (currentMoment.music) {
            totalDuration = currentMoment.music.duration || 18;
        }

        // Handle Music
        if (currentMoment.music?.previewUrl) {
            audioRef.current = new Audio(currentMoment.music.previewUrl);
            audioRef.current.currentTime = currentMoment.music.startTime || 0;
            audioRef.current.muted = isMuted;
            audioRef.current.play().catch(e => console.log("Audio blocked"));
        }

        // Auto-advance (only for non-video)
        let timer;
        if (currentMoment.type !== "video") {
            timer = setTimeout(() => {
                handleNext();
            }, totalDuration * 1000);
        }

        return () => {
            if (timer) clearTimeout(timer);
            stopAudio();
        };
    }, [currentIndex, isOpen, currentMoment?._id]);

    // Handle Mute Sync
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
        stopAudio();
        onClose();
    };

    if (!isOpen || !currentMoment) return null;

    const user = currentMoment.userId;
    const isOnlyMusic = currentMoment.type === "music" && !currentMoment.mediaUrl;

    return createPortal(
        <div className="modal-overlay moments-aura-viewer-overlay" onClick={handleClose}>
            <div className="moments-aura-viewer-content" onClick={(e) => e.stopPropagation()}>
                {/* Progress Bars */}
                <div className="aura-progress-bars">
                    {moments.map((_, idx) => (
                        <div key={idx} className="aura-progress-bg">
                            <div 
                                className={`aura-progress-fill ${idx === currentIndex ? 'active' : (idx < currentIndex ? 'completed' : '')}`} 
                                style={idx === currentIndex ? { 
                                    '--duration': `${currentMoment.type === "video" ? '0' : (currentMoment.music?.duration || 10)}s`,
                                    animationPlayState: 'running'
                                } : {}}
                            />
                        </div>
                    ))}
                </div>

                <div className="aura-viewer-header">
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
                                        🎵 {currentMoment.music.title} • {currentMoment.music.artist}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="aura-viewer-actions">
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
                            onEnded={handleNext}
                            onLoadedMetadata={(e) => {
                                // Sync progress bar with video duration
                                e.target.closest('.moments-aura-viewer-content').querySelector('.aura-progress-fill.active').style.setProperty('--duration', `${e.target.duration}s`);
                            }}
                        />
                    ) : currentMoment.mediaUrl ? (
                        <img src={currentMoment.mediaUrl} alt="Moment" />
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

                {/* Navigation Zones */}
                <div className="aura-nav-zone left" onClick={handlePrev} />
                <div className="aura-nav-zone right" onClick={handleNext} />
                <div className="aura-viewer-footer">#Moments.</div>
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentViewer);
