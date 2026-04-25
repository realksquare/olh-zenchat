import { useState, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { formatDistanceToNow } from "date-fns";

const MomentViewer = ({ moments, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { viewMoment } = useMomentStore();
    
    const currentMoment = moments[currentIndex];

    useEffect(() => {
        if (!isOpen || !currentMoment) return;

        // Auto-advance after 5 seconds
        const timer = setTimeout(() => {
            handleNext();
        }, 5000);

        // Mark as viewed (One-Breath rule)
        viewMoment(currentMoment._id);

        return () => clearTimeout(timer);
    }, [currentIndex, isOpen, currentMoment?._id]);

    const handleNext = () => {
        if (currentIndex < moments.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    if (!isOpen || !currentMoment) return null;

    const user = currentMoment.userId;

    return createPortal(
        <div className="modal-overlay moment-viewer-overlay" onClick={onClose}>
            <div className="moment-viewer-content" onClick={(e) => e.stopPropagation()}>
                {/* Progress Bars */}
                <div className="moment-progress-bars">
                    {moments.map((_, idx) => (
                        <div key={idx} className="progress-bar-bg">
                            <div 
                                className={`progress-bar-fill ${idx === currentIndex ? 'active' : (idx < currentIndex ? 'completed' : '')}`} 
                            />
                        </div>
                    ))}
                </div>

                <div className="moment-viewer-header">
                    <div className="avatar avatar-sm">
                        {user?.avatar ? (
                            <img src={user.avatar} alt={user.username} />
                        ) : (
                            <span>{user?.username?.slice(0, 2).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="moment-user-info">
                        <span className="moment-username">{user?.username}</span>
                        <span className="moment-time">
                            {formatDistanceToNow(new Date(currentMoment.createdAt), { addSuffix: true })}
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="moment-viewer-media">
                    {currentMoment.type === "video" ? (
                        <video src={currentMoment.mediaUrl} autoPlay muted playsInline onEnded={handleNext} />
                    ) : currentMoment.mediaUrl ? (
                        <img src={currentMoment.mediaUrl} alt="Moment" />
                    ) : null}
                    
                    {currentMoment.content && (
                        <div className="moment-text-overlay">
                            <p>{currentMoment.content}</p>
                        </div>
                    )}
                </div>

                {/* Navigation Zones */}
                <div className="moment-nav left" onClick={handlePrev} />
                <div className="moment-nav right" onClick={handleNext} />
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentViewer);
