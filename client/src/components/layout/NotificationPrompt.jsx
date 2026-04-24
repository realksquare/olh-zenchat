import { useState, useEffect } from "react";
import { requestNotificationPermission } from "../../utils/firebase";
import { useAuthStore } from "../../stores/authStore";
import axiosInstance from "../../utils/axios";

const NotificationPrompt = () => {
    const [show, setShow] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { user, setFCMToken } = useAuthStore();

    useEffect(() => {
        const checkPermission = async () => {
            if (!user) return;
            if (Notification.permission === "default") {
                const timer = setTimeout(() => setShow(true), 3000);
                return () => clearTimeout(timer);
            }
        };
        checkPermission();
    }, [user]);

    const handleEnable = async () => {
        setIsLoading(true);
        try {
            const token = await requestNotificationPermission();
            if (token) {
                const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
                await axiosInstance.put("/auth/me", { 
                    fcmToken: token,
                    deviceType: isPWA ? "pwa" : "browser",
                    notificationsEnabled: true
                });
                setFCMToken(token);
            }
            setShow(false); // Close regardless of token if they interacted
        } catch (err) {
            console.error("Failed to enable notifications", err);
            setShow(false);
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="notif-prompt-overlay">
            <div className="notif-prompt-card">
                <div className="notif-prompt-icon">🔔</div>
                <h3>Stay Connected!</h3>
                <p>Enable push notifications for instant updates when you're offline!</p>
                <div className="notif-prompt-actions">
                    <button className="notif-btn-later" onClick={() => setShow(false)} disabled={isLoading}>Later</button>
                    <button className="notif-btn-enable" onClick={handleEnable} disabled={isLoading}>
                        {isLoading ? "Please wait..." : "Enable Now"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationPrompt;
