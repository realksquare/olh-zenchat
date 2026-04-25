import { memo } from "react";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";

const MomentsRow = ({ onAddMoment, onViewMoment }) => {
    const { user } = useAuthStore();
    const moments = useMomentStore((s) => s.moments);

    // Group moments by user
    const userMoments = useMemo(() => {
        const groups = {};
        moments.forEach(m => {
            const uid = m.userId?._id || m.userId;
            if (uid === user?._id) return; // Skip self in the feed
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

    const myMoments = moments.filter(m => (m.userId?._id || m.userId) === user?._id);

    return (
        <div className="moments-row-container">
            <div className="moments-scroll">
                {/* Your Moment */}
                <div className="moment-item self" onClick={onAddMoment}>
                    <div className={`avatar avatar-md ${myMoments.length > 0 ? 'moments-halo' : ''}`}>
                        {user?.avatar ? (
                            <img src={user.avatar} alt="Me" />
                        ) : (
                            <span>{user?.username?.slice(0, 2).toUpperCase()}</span>
                        )}
                        <div className="add-moment-btn">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </div>
                    </div>
                    <span className="moment-label">You</span>
                </div>

                {/* Contact Moments */}
                {userMoments.map((group) => (
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

// Internal useMemo since I forgot to import it in the code block above
import { useMemo } from "react";

export default memo(MomentsRow);
