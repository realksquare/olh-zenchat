import { memo, useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { VerifiedTick } from "./Icons";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";

const UserCardModal = ({ user, isOpen, onClose, hasMoments = false, isOnline = false, isSPOp = false, isContact = false, onViewMoments, iBlocked = false, theyBlocked = false }) => {
    const [blockError, setBlockError] = useState(null);
    const [showConfirmBlock, setShowConfirmBlock] = useState(false);

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
    const zenUsers = useChatStore((s) => s.zenUsers);

    // Safety exit
    if (!isOpen || !user) return null;

    // Force offline if blocked relationship exists
    const effectiveIsOnline = isOnline && !iBlocked && !theyBlocked;

    // Extremely defensive metadata extraction
    const username = typeof user.username === 'string' ? user.username : 'User';
    const fullName = typeof user.fullName === 'string' ? user.fullName : null;
    const userId = typeof user._id === 'string' ? user._id : (user._id?.toString() || 'unknown');
    const isOtherInZen = zenUsers[userId] || zenUsers[userId?.toString()];

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
            setShowConfirmBlock(true);
        }
    };

    const handleConfirmBlock = async () => {
        setShowConfirmBlock(false);
        setBlockError(null);
        const res = await blockUser(userId);
        if (!res.success) {
            setBlockError(res.message);
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
                    <div className="user-card-avatar-wrap">
                        <div
                            className={`avatar avatar-xl ${hasMoments && !iBlocked && !theyBlocked ? 'moments-halo-thin' : ''}`}
                            style={hasMoments && !iBlocked && !theyBlocked ? { '--halo-color': haloColor } : {}}
                        >
                            {user.avatar ? (
                                <img src={user.avatar} alt={username} />
                            ) : (
                                <span>{initials}</span>
                            )}
                        </div>
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
                                {effectiveIsOnline ? (isOtherInZen ? "Online - on #ZenMode" : "Active Now") : "Offline"}
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
            {showConfirmBlock && createPortal(
                <div className="modal-overlay moments-aura-overlay" onClick={() => setShowConfirmBlock(false)} style={{ zIndex: 20000 }}>
                    <div className="moments-aura-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "320px", padding: "32px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "#ef4444" }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                        </div>
                        <h3 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: "800", marginBottom: "12px" }}>Block @{username}?</h3>
                        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "24px", lineHeight: "1.5" }}>
                            Blocked users will no longer be able to message you, see your online status, or view your moments.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <button className="btn btn-danger btn-full" onClick={handleConfirmBlock} style={{ background: "#ef4444", color: "#fff", border: "none" }}>
                                Block User
                            </button>
                            <button className="btn btn-outline btn-full" onClick={() => setShowConfirmBlock(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>,
        document.body
    );
};

export default memo(UserCardModal);
