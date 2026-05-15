import { useState, useEffect } from "react";
import { requestNotificationPermission } from "../../utils/firebase";
import { useAuthStore } from "../../stores/authStore";
import axiosInstance from "../../utils/axios";

const NotificationPrompt = () => {
    const [show, setShow] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuthStore();

    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const checkPermission = async () => {
            if (!user) return;
            if (Notification.permission === "default" && !sessionStorage.getItem("notifPromptDismissed")) {
                const timer = setTimeout(() => setShow(true), 3000);
                return () => clearTimeout(timer);
            }
        };
        checkPermission();
    }, [user]);

    const handleDismiss = () => {
        sessionStorage.setItem("notifPromptDismissed", "true");
        setShow(false);
    };

    const handleEnable = async () => {
        setIsLoading(true);
        try {
            const token = await requestNotificationPermission();
            if (token) {
                const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
                const { data } = await axiosInstance.put("/auth/me", { 
                    fcmToken: token,
                    deviceType: isPWA ? "pwa" : "browser",
                    notificationsEnabled: true
                });
                if (data?.user) {
                    useAuthStore.getState().updateUser(data.user);
                    localStorage.setItem("zenchat_user", JSON.stringify(data.user));
                }
                setSuccess(true);
                setTimeout(() => handleDismiss(), 2000);
            } else {
                handleDismiss();
            }
        } catch (err) {
            console.error("Failed to enable notifications", err);
            handleDismiss();
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="notif-prompt-overlay">
            <div className="notif-prompt-card">
                {success ? (
                    <>
                        <div className="notif-prompt-icon" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>✓</div>
                        <h3>Success!</h3>
                        <p>Push notifications are now enabled for this browser.</p>
                    </>
                ) : (
                    <>
                        <div className="notif-prompt-icon">🔔</div>
                        <h3>Stay Connected!</h3>
                        <p>Enable push notifications for instant updates when you're offline!</p>
                        <div className="notif-prompt-actions">
                            <button className="notif-btn-later" onClick={handleDismiss} disabled={isLoading}>Later</button>
                            <button className="notif-btn-enable" onClick={handleEnable} disabled={isLoading} style={{ position: 'relative' }}>
                                {isLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="banner-spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></span>
                                        Enabling...
                                    </div>
                                ) : "Enable Now"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default NotificationPrompt;
