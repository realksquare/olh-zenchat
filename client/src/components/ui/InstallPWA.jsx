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
        <div
            className="modal-overlay"
            onClick={handleDismiss}
            style={{ zIndex: 9999 }}
        >
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "380px", textAlign: "center", padding: "2rem", overflow: 'hidden' }}
            >
                {isSuccess ? (
                    <>
                        <div style={{
                            width: "72px", height: "72px", borderRadius: "50%",
                            background: "rgba(34, 197, 94, 0.2)", color: "#22c55e",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 1.25rem",
                            fontSize: '32px'
                        }}>✓</div>
                        <h2 style={{ marginBottom: "0.5rem" }}>Installed!</h2>
                        <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                            ZenChat has been successfully added to your device.
                        </p>
                    </>
                ) : (
                    <>
                        {/* App Icon */}
                        <div style={{
                            width: "72px", height: "72px", borderRadius: "20px",
                            background: "linear-gradient(135deg, #3da5d9, #1e7bb8)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 1.25rem",
                            boxShadow: "0 8px 24px rgba(61,165,217,0.35)"
                        }}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>

                        <h2 style={{ marginBottom: "0.5rem", fontSize: "1.3rem" }}>Install ZenChat</h2>
                        <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1.75rem", lineHeight: 1.5 }}>
                            Add ZenChat to your home screen for faster access, offline support, and a native app experience.
                        </p>

                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button
                                onClick={handleDismiss}
                                className="btn"
                                disabled={isLoading}
                                style={{
                                    background: "rgba(255,255,255,0.06)",
                                    color: "#94a3b8",
                                    flex: 1,
                                    border: "1px solid rgba(255,255,255,0.08)"
                                }}
                            >
                                Not now
                            </button>
                            <button
                                onClick={handleInstall}
                                className="btn btn-primary"
                                disabled={isLoading}
                                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", position: 'relative' }}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="banner-spinner" style={{ width: 14, height: 14 }}></span>
                                        Installing...
                                    </>
                                ) : (
                                    <>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                @keyframes progressAnim {
                    from { width: 0%; }
                    to { width: 90%; }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default InstallPWA;
