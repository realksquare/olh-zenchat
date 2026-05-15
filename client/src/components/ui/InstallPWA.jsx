import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const InstallPWA = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        // Don't show if already running as installed PWA or if dismissed in this session
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;

        if (isStandalone || sessionStorage.getItem("pwaPromptDismissed")) return;

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Small delay so it shows after login animation settles
            setTimeout(() => {
                if (!sessionStorage.getItem("pwaPromptDismissed")) {
                    setShowModal(true);
                }
            }, 1500);
        };

        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        setIsLoading(true);
        
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                setIsSuccess(true);
                sessionStorage.setItem("pwaPromptDismissed", "true");
                setTimeout(() => setShowModal(false), 3000);
            } else {
                handleDismiss();
            }
        } catch (err) {
            console.error("PWA Install failed", err);
            handleDismiss();
        } finally {
            setIsLoading(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        sessionStorage.setItem("pwaPromptDismissed", "true");
        setShowModal(false);
    };

    if (!showModal) return null;

    return createPortal(
        <div className="modal-overlay moments-aura-overlay" onClick={handleDismiss} style={{ zIndex: 9999 }}>
            <div
                className="moments-aura-content pwa-install-popup"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "400px", width: "95%", padding: 0, overflow: 'hidden' }}
            >
                <div className="moments-aura-header">
                    <h2 className="moments-aura-title">{isSuccess ? "Installed" : "Install ZenChat"}</h2>
                    <button className="aura-close-btn" onClick={handleDismiss}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div style={{ padding: '0 28px 28px', textAlign: 'center' }}>
                    {isSuccess ? (
                        <>
                            <div style={{
                                width: "72px", height: "72px", borderRadius: "50%",
                                background: "rgba(34, 197, 94, 0.15)", color: "#10b981",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                margin: "0 auto 1.5rem", fontSize: '32px'
                            }}>✓</div>
                            <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6 }}>
                                ZenChat has been successfully added to your device.
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{
                                width: "80px", height: "80px", borderRadius: "24px",
                                background: "linear-gradient(135deg, #3da5d9, #1e7bb8)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                margin: "0 auto 1.5rem",
                                boxShadow: "0 12px 32px rgba(61,165,217,0.3)"
                            }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </div>

                            <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "2rem", lineHeight: 1.6 }}>
                                Add ZenChat to your home screen for faster access, offline support, and a premium native experience.
                            </p>

                            <div style={{ display: "flex", gap: "1rem" }}>
                                <button
                                    onClick={handleDismiss}
                                    className="btn btn-outline"
                                    disabled={isLoading}
                                    style={{ flex: 1, padding: '12px' }}
                                >
                                    Not now
                                </button>
                                <button
                                    onClick={handleInstall}
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
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                            </svg>
                                            Install
                                        </>
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
                    to { width: 95%; }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default InstallPWA;
