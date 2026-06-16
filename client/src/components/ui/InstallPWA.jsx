import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const PWA_DISMISS_KEY = "zenchat_pwa_install_dismissed_time";

const InstallPWA = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showNudgeModal, setShowNudgeModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const handleInstallRef = useRef(null);
    const [customAlert, setCustomAlert] = useState(null);

    const shouldShowPrompt = () => {
        const dismissedTime = localStorage.getItem(PWA_DISMISS_KEY);
        if (dismissedTime) {
            const elapsed = Date.now() - parseInt(dismissedTime, 10);
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;
            if (elapsed < ONE_DAY_MS) {
                return false;
            }
        }
        return true;
    };

    useEffect(() => {
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;

        if (isStandalone) {
            localStorage.setItem("zenchat_pwa_installed", "true");
            return;
        }

        // Check if we should show the browser nudge modal
        const checkNudge = async () => {
            const dismissedNudgeTime = localStorage.getItem("zenchat_pwa_nudge_dismissed_time");
            if (dismissedNudgeTime) {
                const elapsed = Date.now() - parseInt(dismissedNudgeTime, 10);
                const ONE_DAY_MS = 24 * 60 * 60 * 1000;
                if (elapsed < ONE_DAY_MS) {
                    return;
                }
            }

            const isInstalled = localStorage.getItem("zenchat_pwa_installed") === "true";
            if (isInstalled) {
                setTimeout(() => {
                    setShowNudgeModal(true);
                }, 3000);
            }
        };

        checkNudge();

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            window.deferredPrompt = e;
            window.dispatchEvent(new CustomEvent("pwa-prompt-available", { detail: e }));
            
            if (shouldShowPrompt()) {
                setTimeout(() => {
                    setShowModal(true);
                }, 1500);
            }
        };

        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    useEffect(() => {
        const handleAppInstalled = () => {
            localStorage.setItem("zenchat_pwa_installed", "true");
            window.dispatchEvent(new CustomEvent("pwa-installed-status-changed"));
        };
        window.addEventListener('appinstalled', handleAppInstalled);
        return () => window.removeEventListener('appinstalled', handleAppInstalled);
    }, []);

    useEffect(() => {
        const handleOpenInstall = () => {
            setShowModal(true);
            setTimeout(() => {
                handleInstallRef.current?.();
            }, 100);
        };
        const handleOpenNudge = () => {
            setShowNudgeModal(true);
        };

        window.addEventListener("open-pwa-install-modal", handleOpenInstall);
        window.addEventListener("open-pwa-nudge-modal", handleOpenNudge);

        return () => {
            window.removeEventListener("open-pwa-install-modal", handleOpenInstall);
            window.removeEventListener("open-pwa-nudge-modal", handleOpenNudge);
        };
    }, []);

    const handleInstall = async () => {
        const promptToUse = deferredPrompt || window.deferredPrompt;
        if (!promptToUse) {
            setShowModal(false);
            setCustomAlert("Install prompt is unavailable. Try refreshing the page or use your browser's 'Add to Home Screen' option.");
            return;
        }
        setIsLoading(true);

        try {
            promptToUse.prompt();
            const { outcome } = await promptToUse.userChoice;

            if (outcome === 'accepted') {
                const fallbackTimeout = setTimeout(() => {
                    setIsSuccess(true);
                    setIsLoading(false);
                    localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
                    localStorage.setItem("zenchat_pwa_installed", "true");
                    window.dispatchEvent(new CustomEvent("pwa-installed-status-changed"));
                    setTimeout(() => setShowModal(false), 3000);
                }, 15000);

                const onInstalled = () => {
                    clearTimeout(fallbackTimeout);
                    setIsSuccess(true);
                    setIsLoading(false);
                    localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
                    localStorage.setItem("zenchat_pwa_installed", "true");
                    window.dispatchEvent(new CustomEvent("pwa-installed-status-changed"));
                    setTimeout(() => setShowModal(false), 3000);
                    window.removeEventListener('appinstalled', onInstalled);
                };
                window.addEventListener('appinstalled', onInstalled);
            } else {
                handleDismiss();
                setIsLoading(false);
            }
        } catch (err) {
            console.error("PWA Install failed", err);
            handleDismiss();
            setIsLoading(false);
        } finally {
            setDeferredPrompt(null);
            window.deferredPrompt = null;
        }
    };

    // Keep ref in sync so event listeners always call latest version
    useEffect(() => { handleInstallRef.current = handleInstall; }, [deferredPrompt]);

    const handleDismiss = () => {
        localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
        setShowModal(false);
    };

    const handleDismissNudge = () => {
        localStorage.setItem("zenchat_pwa_nudge_dismissed_time", Date.now().toString());
        setShowNudgeModal(false);
    };

    if (!showModal && !showNudgeModal && !customAlert) return null;

    if (showNudgeModal) {
        return (
            <>
                {createPortal(
                    <div className="modal-overlay moments-aura-overlay" onClick={handleDismissNudge} style={{ zIndex: 9999 }}>
                        <div
                            className="moments-aura-content pwa-install-popup"
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: "400px", maxWidth: "95%", padding: 0, overflow: 'hidden' }}
                        >
                            <div className="moments-aura-header">
                                <h2 className="moments-aura-title">Open ZenChat PWA</h2>
                                <button className="aura-close-btn" onClick={handleDismissNudge}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div style={{ padding: '0 28px 28px', textAlign: 'center' }}>
                                <div style={{
                                    width: "80px", height: "80px", borderRadius: "24px",
                                    background: "linear-gradient(135deg, #10b981, #059669)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    margin: "0 auto 1.5rem",
                                    boxShadow: "0 12px 32px rgba(16,185,129,0.3)"
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                    </svg>
                                </div>

                                <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "2rem", lineHeight: 1.6 }}>
                                    You have the ZenChat PWA installed on your device! Switch to the PWA app for a premium, fast, and native experience.
                                </p>

                                <div style={{ display: "flex", gap: "1rem" }}>
                                    <button
                                        onClick={handleDismissNudge}
                                        className="btn btn-outline"
                                        style={{ flex: 1, padding: '12px' }}
                                    >
                                        Not now
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleDismissNudge();
                                            setCustomAlert("To open the PWA, please click your browser's options menu (e.g. three dots in Chrome) and select 'Open in ZenChat', or launch ZenChat from your home screen / application launcher!");
                                        }}
                                        className="btn btn-primary"
                                        style={{ flex: 1, padding: '12px', background: "#10b981", border: "none", color: "var(--color-text, #fff)", fontWeight: "600" }}
                                    >
                                        Open App
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
                {customAlert && createPortal(
                    <div className="modal-overlay moments-aura-overlay" onClick={() => setCustomAlert(null)} style={{ zIndex: 30000 }}>
                        <div className="moments-aura-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "340px", padding: "28px", textAlign: "center" }}>
                            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "var(--color-primary)" }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                            </div>
                            <h3 style={{ color: "var(--color-text, #fff)", fontSize: "1.1rem", fontWeight: "700", marginBottom: "12px" }}>Install ZenChat</h3>
                            <p style={{ color: "var(--color-text-muted, rgba(255, 255, 255, 0.65))", fontSize: "0.85rem", marginBottom: "24px", lineHeight: "1.6" }}>
                                {customAlert}
                            </p>
                            <button className="btn btn-primary" onClick={() => setCustomAlert(null)} style={{ width: "100%", padding: "10px", fontWeight: "600" }}>
                                OK
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
            </>
        );
    }

    return (
        <>
            {showModal && createPortal(
                <div className="modal-overlay moments-aura-overlay" onClick={handleDismiss} style={{ zIndex: 9999 }}>
                    <div
                        className="moments-aura-content pwa-install-popup"
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: "400px", maxWidth: "95%", padding: 0, overflow: 'hidden' }}
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
                                            width: '100%', height: '4px', background: 'var(--color-overlay, rgba(255, 255, 255, 0.05))',
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
            )}
            {customAlert && createPortal(
                <div className="modal-overlay moments-aura-overlay" onClick={() => setCustomAlert(null)} style={{ zIndex: 30000 }}>
                    <div className="moments-aura-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "340px", padding: "28px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "var(--color-primary)" }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </div>
                        <h3 style={{ color: "var(--color-text, #fff)", fontSize: "1.1rem", fontWeight: "700", marginBottom: "12px" }}>Install ZenChat</h3>
                        <p style={{ color: "var(--color-text-muted, rgba(255, 255, 255, 0.65))", fontSize: "0.85rem", marginBottom: "24px", lineHeight: "1.6" }}>
                            {customAlert}
                        </p>
                        <button className="btn btn-primary" onClick={() => setCustomAlert(null)} style={{ width: "100%", padding: "10px", fontWeight: "600" }}>
                            OK
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default InstallPWA;
