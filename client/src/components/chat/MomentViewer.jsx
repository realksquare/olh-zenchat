import { useState, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { formatDistanceToNow } from "date-fns";

const MomentViewer = ({ moments, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [audio, setAudio] = useState(null);
    const { viewMoment } = useMomentStore();
    
    const currentMoment = moments[currentIndex];

    useEffect(() => {
        if (!isOpen || !currentMoment) return;

        const duration = (currentMoment.music?.duration || 5) * 1000;

        // Auto-advance
        const timer = setTimeout(() => {
            handleNext();
        }, duration);

        // Mark as viewed
        viewMoment(currentMoment._id);

        // Handle Music (Only when viewed)
        if (currentMoment.music?.previewUrl) {
            const newAudio = new Audio(currentMoment.music.previewUrl);
            newAudio.play().catch(e => console.log("Audio blocked"));
            setAudio(newAudio);
        }

        return () => {
            clearTimeout(timer);
            if (audio) {
                audio.pause();
                setAudio(null);
            }
        };
    }, [currentIndex, isOpen, currentMoment?._id]);

    // Cleanup audio on unmount or slide change
    useEffect(() => {
        return () => {
            if (audio) {
                audio.pause();
                setAudio(null);
            }
        };
    }, [currentIndex, audio]);

    const handleNext = () => {
        if (audio) audio.pause();
        if (currentIndex < moments.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (audio) audio.pause();
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    if (!isOpen || !currentMoment) return null;

    const user = currentMoment.userId;

    return createPortal(
        <div className="modal-overlay moments-aura-viewer-overlay" onClick={onClose}>
            <div className="moments-aura-viewer-content" onClick={(e) => e.stopPropagation()}>
                {/* Progress Bars */}
                <div className="aura-progress-bars">
                    {moments.map((_, idx) => (
                        <div key={idx} className="aura-progress-bg">
                            <div 
                                className={`aura-progress-fill ${idx === currentIndex ? 'active' : (idx < currentIndex ? 'completed' : '')}`} 
                                style={idx === currentIndex ? { '--duration': `${currentMoment.music?.duration || 5}s` } : {}}
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
                            <span className="aura-time">
                                {formatDistanceToNow(new Date(currentMoment.createdAt), { addSuffix: true })}
                            </span>
                        </div>
                    </div>
                    <div className="aura-viewer-branding">#Moments.</div>
                    <button className="aura-viewer-close" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="aura-viewer-media">
                    {currentMoment.type === "video" ? (
                        <video src={currentMoment.mediaUrl} autoPlay muted playsInline onEnded={handleNext} />
                    ) : currentMoment.mediaUrl ? (
                        <img src={currentMoment.mediaUrl} alt="Moment" />
                    ) : (
                        <div className="aura-text-only-bg" />
                    )}
                    
                    <div className="aura-content-overlay">
                        {currentMoment.music && (
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
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentViewer);
