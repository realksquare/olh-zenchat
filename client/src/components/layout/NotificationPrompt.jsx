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
        <div className="modal-overlay moments-aura-overlay" onClick={handleDismiss} style={{ zIndex: 9999 }}>
            <div
                className="moments-aura-content notif-prompt-popup"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "400px", width: "95%", padding: 0, overflow: 'hidden' }}
            >
                <div className="moments-aura-header">
                    <h2 className="moments-aura-title">{success ? "Notifications" : "Stay Connected"}</h2>
                    <button className="aura-close-btn" onClick={handleDismiss}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div style={{ padding: '0 28px 28px', textAlign: 'center' }}>
                    {success ? (
                        <>
                            <div style={{
                                width: "72px", height: "72px", borderRadius: "50%",
                                background: "rgba(34, 197, 94, 0.15)", color: "#10b981",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                margin: "0 auto 1.5rem", fontSize: '32px'
                            }}>✓</div>
                            <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6 }}>
                                Push notifications are now active! You'll stay updated even when offline.
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{
                                width: "80px", height: "80px", borderRadius: "24px",
                                background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                margin: "0 auto 1.5rem", fontSize: '36px'
                            }}>🔔</div>

                            <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "2rem", lineHeight: 1.6 }}>
                                Enable push notifications to receive instant updates and messages when you're not in the app.
                            </p>

                            <div style={{ display: "flex", gap: "1rem" }}>
                                <button
                                    onClick={handleDismiss}
                                    className="btn btn-outline"
                                    disabled={isLoading}
                                    style={{ flex: 1, padding: '12px' }}
                                >
                                    Later
                                </button>
                                <button
                                    onClick={handleEnable}
                                    className="btn btn-primary"
                                    disabled={isLoading}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: '12px' }}
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="banner-spinner" style={{ width: 14, height: 14 }}></span>
                                            Wait...
                                        </>
                                    ) : (
                                        "Enable Now"
                                    )}
                                </button>
                            </div>

                            {isLoading && (
                                <div style={{
                                    width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)',
                                    marginTop: '2rem', borderRadius: '4px', overflow: 'hidden'
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
            </div>
            <style>{`
                @keyframes progressAnim {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default NotificationPrompt;
