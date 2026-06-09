import { memo, useMemo } from "react";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";

const MomentsRow = ({ onAddMoment, onViewMoment }) => {
    const userId = useAuthStore((s) => s.user?._id);
    const userAvatar = useAuthStore((s) => s.user?.avatar);
    const userUsername = useAuthStore((s) => s.user?.username);
    // Subscribe directly so the component re-renders when moments change
    const moments = useMomentStore((s) => s.moments);
    const getHaloColor = useMomentStore((s) => s.getHaloColor);
    const isZenMode = useChatStore((s) => s.isZenMode);
    const zenUsers = useChatStore((s) => s.zenUsers);

    const userGroups = useMemo(() => {
        if (isZenMode) return [];
        const groups = {};
        moments.forEach(m => {
            const uid = (m.userId?._id || m.userId)?.toString();
            if (!uid || uid === userId?.toString()) return;
            if (zenUsers[uid] || zenUsers[uid?.toString()]) return;
            if (!groups[uid]) {
                groups[uid] = { user: m.userId, moments: [] };
            }
            groups[uid].moments.push(m);
        });
        return Object.values(groups);
    }, [moments, userId, isZenMode, zenUsers]);

    const myMoments = useMemo(() =>
        moments.filter(m => (m.userId?._id || m.userId)?.toString() === userId?.toString())
    , [moments, userId]);

    return (
        <div className="moments-row-container">
            <div className="moments-row">
                {/* Own avatar */}
                <div className="moment-item" onClick={() => myMoments.length > 0 ? onViewMoment(myMoments) : onAddMoment()}>
                    <div
                        className={`avatar avatar-md${myMoments.length > 0 ? ' moments-halo' : ''}`}
                        style={myMoments.length > 0 ? { '--halo-color': '#3b82f6' } : {}}
                    >
                        {userAvatar ? (
                            <img src={userAvatar} alt="Me" />
                        ) : (
                            <span>{userUsername?.slice(0, 2).toUpperCase()}</span>
                        )}
                        <div className="add-moment-btn" onClick={(e) => { e.stopPropagation(); onAddMoment(); }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </div>
                    </div>
                    <span className="moment-label">You</span>
                </div>

                {/* Contacts' moments — color computed live */}
                {userGroups.map((group, idx) => {
                    const uid = group.user?._id || group.user;
                    const color = getHaloColor(uid, userId);
                    return (
                        <div
                            key={uid || idx}
                            className="moment-item"
                            onClick={() => onViewMoment(group.moments)}
                        >
                            <div
                                className="avatar avatar-md moments-halo"
                                style={{ '--halo-color': color }}
                            >
                                {group.user?.avatar ? (
                                    <img src={group.user.avatar} alt={group.user.username} />
                                ) : (
                                    <span>{group.user?.username?.slice(0, 2).toUpperCase()}</span>
                                )}
                            </div>
                            <span className="moment-label">{group.user?.username}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default memo(MomentsRow);
