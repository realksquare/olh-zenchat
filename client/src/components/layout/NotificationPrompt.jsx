import { useState, useEffect } from "react";
import { requestNotificationPermission } from "../../utils/firebase";
import { useAuthStore } from "../../stores/authStore";
import axiosInstance from "../../utils/axios";

const NotificationPrompt = () => {
    const [show, setShow] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const user = useAuthStore((s) => s.user);
    const userId = user?._id;
    const fcmTokens = user?.fcmTokens;

    useEffect(() => {
        if (!user) return;
        
        // Safety check for Notification API
        if (typeof window.Notification === 'undefined') return;

        // Don't show if blocked
        if (window.Notification.permission === "denied") return;

        // Check if already subscribed on this device type
        const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
        const deviceType = isPWA ? "pwa" : "browser";
        const isSubscribed = window.Notification.permission === "granted" &&
            user?.fcmTokens?.some(t => t.deviceType === deviceType);

        if (isSubscribed) return;

        // Use local component state so it re-prompts on each reload/new session/login
        if (dismissed) return;

        const delay = isPWA ? 200 : 1500;
        const timer = setTimeout(() => setShow(true), delay);
        return () => clearTimeout(timer);
    }, [userId, fcmTokens, dismissed]);

    const handleDismiss = () => {
        setDismissed(true);
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
                localStorage.setItem("notifPromptDismissedAt", String(Date.now() + 365 * 24 * 60 * 60 * 1000));
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
        <div className="modal-overlay moments-aura-overlay" onClick={isLoading ? undefined : handleDismiss} style={{ zIndex: 20001 }}>
            <div
                className="moments-aura-content notif-prompt-popup"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "400px", width: "95%", padding: 0, overflow: 'hidden', position: 'relative' }}
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
                                margin: "0 auto 1.5rem"
                            }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
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
                                margin: "0 auto 1.5rem"
                            }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                                </svg>
                            </div>

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

                            {/* Loading overlay inside card */}
                            {isLoading && (
                                <div style={{
                                    position: 'absolute', inset: 0, borderRadius: '20px',
                                    background: 'rgba(10,14,20,0.85)', backdropFilter: 'blur(4px)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', gap: '16px', zIndex: 1
                                }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '50%',
                                        border: '3px solid rgba(59,130,246,0.15)',
                                        borderTopColor: '#3b82f6',
                                        animation: 'spin 0.9s linear infinite'
                                    }} />
                                    <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}>Subscribing…</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default NotificationPrompt;
