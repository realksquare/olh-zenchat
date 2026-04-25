import { memo, useMemo } from "react";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";

const MomentsRow = ({ onAddMoment, onViewMoment }) => {
    const { user } = useAuthStore();
    const moments = useMomentStore((s) => s.moments);

    // Group moments by user
    const userGroups = useMemo(() => {
        const groups = {};
        moments.forEach(m => {
            const uid = m.userId?._id || m.userId;
            if (uid === user?._id) return;
            if (!groups[uid]) {
                groups[uid] = {
                    user: m.userId,
                    moments: []
                };
            }
            groups[uid].moments.push(m);
        });
        return Object.values(groups);
    }, [moments, user?._id]);

    const myMoments = useMemo(() => 
        moments.filter(m => (m.userId?._id || m.userId) === user?._id)
    , [moments, user?._id]);

    return (
        <div className="moments-row-container">
            <div className="moments-row">
                {/* Current User's Moment Aura */}
                <div className="moment-item" onClick={() => myMoments.length > 0 ? onViewMoment(myMoments) : onAddMoment()}>
                    <div className={`avatar avatar-md ${myMoments.length > 0 ? 'moments-halo' : ''}`}>
                        {user?.avatar ? (
                            <img src={user.avatar} alt="Me" />
                        ) : (
                            <span>{user?.username?.slice(0, 2).toUpperCase()}</span>
                        )}
                        <div className="add-moment-btn">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </div>
                    </div>
                    <span className="moment-label">You</span>
                </div>

                {/* Contacts' Moments */}
                {userGroups.map((group) => (
                    <div 
                        key={group.user?._id || Math.random()} 
                        className="moment-item"
                        onClick={() => onViewMoment(group.moments)}
                    >
                        <div className="avatar avatar-md moments-halo">
                            {group.user?.avatar ? (
                                <img src={group.user.avatar} alt={group.user.username} />
                            ) : (
                                <span>{group.user?.username?.slice(0, 2).toUpperCase()}</span>
                            )}
                        </div>
                        <span className="moment-label">{group.user?.username}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default memo(MomentsRow);
