import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import axiosInstance from "../../utils/axios";
import "./PurgeNoticeModal.css";

const PurgeNoticeModal = () => {
    const user = useAuthStore((s) => s.user);
    const setUser = useAuthStore((s) => s.setUser);
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user && !user.hasSeenPurgeNotice) {
            setIsVisible(true);
        }
    }, [user]);

    if (!isVisible || !user) return null;

    const handleAcknowledge = async () => {
        setLoading(true);
        try {
            await axiosInstance.put("/auth/purge-notice");
            setUser({ ...user, hasSeenPurgeNotice: true });
            setIsVisible(false);
        } catch (err) {
            console.error("Failed to acknowledge purge notice:", err);
            setLoading(false);
        }
    };

    return createPortal(
        <div className="purge-notice-overlay">
            <div className="purge-notice-content">
                <div className="purge-notice-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M12 11v6" />
                        <path d="M12 7h.01" />
                    </svg>
                </div>
                <h2>Important Update on Data Privacy</h2>
                <p>
                    In our ongoing effort to promote digital wellness and meaningful communication, text messages older than 21 days from tomorrow (26/5/2026) will be automatically deleted unless marked as <strong>"Fav"</strong>.
                </p>
                <p>
                    Media and documents will <strong>not</strong> be deleted and will remain forever.
                </p>
                
                <button 
                    className="btn btn-primary purge-btn" 
                    onClick={handleAcknowledge}
                    disabled={loading}
                >
                    {loading ? "Updating..." : "Okay, I understand"}
                </button>
            </div>
        </div>,
        document.body
    );
};

export default PurgeNoticeModal;
