import { memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { VerifiedTick } from "./Icons";
import { useMomentStore } from "../../stores/momentStore";

const UserCardModal = ({ user, isOpen, onClose, hasMoments = false, isOnline = false }) => {
    const getHaloColor = useMomentStore((s) => s.getHaloColor);
    if (!isOpen || !user) return null;

    const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : "??";
    
    // Privacy check for Full Name
    const canSeeFullName = useMemo(() => {
        const privacy = user.privacySettings?.fullName || "everyone";
        if (privacy === "everyone") return true;
        if (privacy === "nobody") return false;
        // For "contacts", we assume if this modal is open from a chat, 
        // they are likely in a context where they can see it or the server filtered it
        // But let's be safe and check if fullName exists in the object
        return !!user.fullName;
    }, [user]);

    const joinedDate = useMemo(() => {
        if (!user.createdAt) return "Unknown";
        return format(new Date(user.createdAt), "MMMM yyyy");
    }, [user.createdAt]);

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content user-card-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="user-card-header">
                    <div 
                        className={`avatar avatar-xl ${hasMoments ? 'moments-halo-thin' : ''}`}
                        style={hasMoments ? { '--halo-color': getHaloColor(user._id) } : {}}
                    >
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.username} />
                        ) : (
                            <span>{getInitials(user.username)}</span>
                        )}
                        {isOnline && <span className="online-dot-large" />}
                    </div>
                </div>

                <div className="user-card-body">
                    <div className="user-card-info">
                        <h2 className="user-card-username">
                            @{user.username}
                            {user.isVerified && <VerifiedTick />}
                        </h2>
                        {canSeeFullName && user.fullName && (
                            <p className="user-card-fullname">{user.fullName}</p>
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
