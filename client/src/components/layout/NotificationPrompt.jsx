import { useState, useEffect } from "react";
import { requestNotificationPermission } from "../../utils/firebase";
import { useAuthStore } from "../../stores/authStore";
import axiosInstance from "../../utils/axios";

const NotificationPrompt = () => {
    const [show, setShow] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { user } = useAuthStore();

    useEffect(() => {
        if (!user) return;
        
        // Show after 5s if not dismissed this session and permission not granted
        if (Notification.permission === "default" && !sessionStorage.getItem("notifPromptDismissed")) {
            const timer = setTimeout(() => setShow(true), 5000);
            return () => clearTimeout(timer);
        }
    }, [user]);

    const handleDismiss = () => {
        sessionStorage.setItem("notifPromptDismissed", "true");
        setShow(false);
    };

    const handleEnable = async () => {
        try {
            const token = await requestNotificationPermission();
            if (token) {
                setIsLoading(true);
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
                sessionStorage.setItem("notifPromptDismissed", "true");
                setTimeout(() => setShow(false), 3000);
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
            <div className="notif-prompt-card" style={{ overflow: 'hidden' }}>
                {success ? (
                    <>
                        <div className="notif-prompt-icon" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>✓</div>
                        <h3>Success!</h3>
                        <p>Push notifications are now active.</p>
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
                                        <span className="banner-spinner" />
                                        Enabling...
                                    </div>
                                ) : "Enable Now"}
                            </button>
                        </div>
                        {isLoading && (
                            <div style={{
                                width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)',
                                marginTop: '1.5rem', borderRadius: '4px', overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%', background: '#3b82f6', width: '0%',
                                    animation: 'progressAnim 3s linear forwards'
                                }}></div>
                            </div>
                        )}
                    </>
                )}
            </div>
            <style>{`
                .banner-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes progressAnim {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default NotificationPrompt;
