import { memo, useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { VerifiedTick } from "./Icons";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";

const UserCardModal = ({ user, isOpen, onClose, hasMoments = false, isOnline = false, isSPOp = false, isContact = false, onViewMoments, iBlocked = false, theyBlocked = false }) => {
    const [blockError, setBlockError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            setBlockError(null);
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    const getHaloColor = useMomentStore((s) => s.getHaloColor);
    const moments = useMomentStore((s) => s.moments);
    const { user: currentUser, blockUser, unblockUser } = useAuthStore();

    // Safety exit
    if (!isOpen || !user) return null;

    // Force offline if blocked relationship exists
    const effectiveIsOnline = isOnline && !iBlocked && !theyBlocked;

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
    // Pass currentUserId so grey aura is shown when all moments are viewed
    const haloColor = getHaloColor(userId, currentUser?._id);
    const userMomentsCount = moments.filter(m => (m.userId?._id || m.userId)?.toString() === userId).length;

    const handleBlockToggle = async () => {
        setBlockError(null);
        if (iBlocked) {
            const res = await unblockUser(userId);
            if (!res.success) {
                setBlockError(res.message);
            }
        } else {
            if (confirm("Are you sure you want to block this user?")) {
                const res = await blockUser(userId);
                if (!res.success) {
                    setBlockError(res.message);
                }
            }
        }
    };

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
                        className={`avatar avatar-xl ${hasMoments && !iBlocked && !theyBlocked ? 'moments-halo-thin' : ''}`}
                        style={hasMoments && !iBlocked && !theyBlocked ? { '--halo-color': haloColor } : {}}
                    >
                        {user.avatar ? (
                            <img src={user.avatar} alt={username} />
                        ) : (
                            <span>{initials}</span>
                        )}
                        {effectiveIsOnline && <span className={`online-dot-large${isSPOp ? ' online-dot-large--amber' : ''}`} />}
                    </div>
                </div>

                <div className="user-card-body">
                    <div className="user-card-info">
                        <h2 className={`user-card-username ${isContact ? "chat-card-name-contact" : ""}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                            <span className="stat-value" style={{ color: effectiveIsOnline ? 'var(--color-primary)' : 'inherit' }}>
                                {effectiveIsOnline ? "Active Now" : "Offline"}
                            </span>
                        </div>
                    </div>

                    <div className="user-card-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        {hasMoments && userMomentsCount > 0 && !iBlocked && !theyBlocked && (
                            <button className="btn btn-primary btn-full moments-btn" onClick={onViewMoments}>
                                View {userMomentsCount} {userMomentsCount === 1 ? '#moment.' : '#moments.'}
                            </button>
                        )}
                        {userId !== currentUser?._id && (
                            <button 
                                className={`btn ${iBlocked ? 'btn-primary' : 'btn-danger'} btn-full`}
                                onClick={handleBlockToggle}
                                style={!iBlocked ? { backgroundColor: '#dc2626', color: '#fff' } : {}}
                            >
                                {iBlocked ? 'Unblock User' : 'Block User'}
                            </button>
                        )}
                        {blockError && (
                            <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', marginTop: '4px' }}>
                                {blockError}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(UserCardModal);
