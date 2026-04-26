import { memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { VerifiedTick } from "./Icons";
import { useMomentStore } from "../../stores/momentStore";

const UserCardModal = ({ user, isOpen, onClose, hasMoments = false, isOnline = false }) => {
    const getHaloColor = useMomentStore((s) => s.getHaloColor);
    
    // Safety exit
    if (!isOpen || !user) return null;

    // Extremely defensive metadata extraction
    const username = typeof user.username === 'string' ? user.username : 'User';
    const fullName = typeof user.fullName === 'string' ? user.fullName : null;
    const userId = typeof user._id === 'string' ? user._id : (user._id?.toString() || 'unknown');
    
    const canSeeFullName = (() => {
        const privacy = user.privacySettings?.fullName || "everyone";
        if (privacy === "everyone") return true;
        if (privacy === "nobody") return false;
        return !!fullName;
    })();

    const joinedDate = (() => {
        try {
            if (!user.createdAt) return "Unknown";
            const date = new Date(user.createdAt);
            if (isNaN(date.getTime())) return "Unknown";
            return format(date, "MMMM yyyy");
        } catch (e) {
            return "Unknown";
        }
    })();

    const initials = username.slice(0, 2).toUpperCase();
    const haloColor = getHaloColor(userId);

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="modal-content user-card-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="user-card-header">
                    <div 
                        className={`avatar avatar-xl ${hasMoments ? 'moments-halo-thin' : ''}`}
                        style={hasMoments ? { '--halo-color': haloColor } : {}}
                    >
                        {user.avatar ? (
                            <img src={user.avatar} alt={username} />
                        ) : (
                            <span>{initials}</span>
                        )}
                        {isOnline && <span className="online-dot-large" />}
                    </div>
                </div>

                <div className="user-card-body">
                    <div className="user-card-info">
                        <h2 className="user-card-username" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            @{username}
                            {user.isVerified && <VerifiedTick />}
                        </h2>
                        {canSeeFullName && fullName && (
                            <p className="user-card-fullname">{fullName}</p>
                        )}
                    </div>

                    <div className="user-card-stats">
                        <div className="stat-item">
                            <span className="stat-label">Joined</span>
                            <span className="stat-value">{joinedDate}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Status</span>
                            <span className="stat-value" style={{ color: isOnline ? 'var(--color-primary)' : 'inherit' }}>
                                {isOnline ? "Active Now" : "Offline"}
                            </span>
                        </div>
                    </div>

                    <div className="user-card-actions">
                        {hasMoments && (
                            <button className="btn btn-primary btn-full moments-btn">
                                View Moments
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(UserCardModal);
