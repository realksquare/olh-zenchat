import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useZenVoiceStore } from "../../stores/zenVoiceStore";
import { ShieldCheck, Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

const ZenVoiceVerifyModal = ({ isOpen, onClose, onVerificationSuccess }) => {
    const {
        isVerified,
        pseudonym,
        pseudonymColor,
        collegeName,
        checkStatus,
        requestDomainOTP,
        confirmDomainOTP,
        isLoading,
        error
    } = useZenVoiceStore();

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [step, setStep] = useState(0); // 0: loading/status-check, 1: selection, 2: email-input, 3: otp-input, 4: domain-pending, 5: success
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [localError, setLocalError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            // Check status on mount
            setStep(0);
            checkStatus().then((res) => {
                if (res?.success && res?.isVerified) {
                    setStep(5);
                } else {
                    setStep(1);
                }
            });
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen, checkStatus]);

    if (!isOpen) return null;

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLocalError("");
        if (!email || !email.includes("@")) {
            setLocalError("Please enter a valid academic email address.");
            return;
        }
        const res = await requestDomainOTP(email);
        if (res.success) {
            if (res.domainPending) {
                setStep(4);
            } else {
                setStep(3);
            }
        } else {
            setLocalError(res.message || "Failed to send code. Please try again.");
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLocalError("");
        if (!otp || otp.trim().length !== 6) {
            setLocalError("Please enter the 6-digit verification code.");
            return;
        }
        const res = await confirmDomainOTP(otp.trim());
        if (res.success) {
            setStep(5);
            if (onVerificationSuccess) onVerificationSuccess();
        } else {
            setLocalError(res.message || "Verification failed. Please check the code.");
        }
    };

    const handleGitHubAuth = () => {
        // Redirect to GitHub student auth endpoint
        window.location.href = `${import.meta.env.VITE_API_URL || ""}/api/zenvoice/auth/github-student`;
    };

    const renderHeader = () => {
        return (
            <div className="admin-header" style={{ paddingBottom: "12px", borderBottom: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <ShieldCheck size={22} className="text-warning" style={{ color: "#f59e0b" }} />
                    <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "var(--color-text, #fff)" }}>Claim your Academic Pseudonym</h2>
                </div>
                <button className="admin-close-btn" onClick={onClose} aria-label="Close modal" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px", fontSize: "1.5rem" }}>&times;</button>
            </div>
        );
    };

    const renderContent = () => {
        if (step === 0 || isLoading) {
            return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
                    <Loader2 size={36} className="animate-spin" style={{ animation: "spin 1s linear infinite", color: "#f59e0b", marginBottom: "16px" }} />
                    <p style={{ color: "#94a3b8", fontSize: "0.95rem" }}>Verifying student status...</p>
                </div>
            );
        }

        if (step === 1) {
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ textAlign: "center", marginBottom: "8px" }}>
                        <p style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.9rem", lineHeight: "1.5", margin: 0 }}>
                            ZenVoice is only for verified students. Pick how you want to prove you're one.
                        </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {/* Option 1: Academic Email */}
                        <div
                            onClick={() => { setStep(2); setLocalError(""); }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "16px",
                                background: "var(--color-surface-offset, #161b22)",
                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                borderRadius: "12px",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                            className="hover-card"
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "var(--color-surface, #0f172a)", border: "1px solid rgba(245, 158, 11, 0.2)", display: "flex", alignItems: "center", justifyValue: "center", justifyContent: "center" }}>
                                    <Mail size={20} style={{ color: "#f59e0b" }} />
                                </div>
                                <div style={{ textAlign: "left" }}>
                                    <h4 style={{ margin: "0 0 2px", fontSize: "0.95rem", fontWeight: "600", color: "#fff" }}>Institutional Email</h4>
                                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)" }}>We send a 6-digit code to your college email. Takes about a minute.</p>
                                </div>
                            </div>
                            <ArrowRight size={18} style={{ color: "#64748b" }} />
                        </div>

                        {/* Option 2: GitHub Student pack */}
                        <div
                            onClick={handleGitHubAuth}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "16px",
                                background: "var(--color-surface-offset, #161b22)",
                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                borderRadius: "12px",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                            className="hover-card"
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "var(--color-surface, #0f172a)", border: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-github">
                                        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                                        <path d="M9 18c-4.51 2-5-2-7-2" />
                                    </svg>
                                </div>
                                <div style={{ textAlign: "left" }}>
                                    <h4 style={{ margin: "0 0 2px", fontSize: "0.95rem", fontWeight: "600", color: "#fff" }}>GitHub Student Developer Pack</h4>
                                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)" }}>If you have GitHub Student Developer Pack, you're already verified. Just tap to connect.</p>
                                </div>
                            </div>
                            <ArrowRight size={18} style={{ color: "#64748b" }} />
                        </div>
                    </div>
                </div>
            );
        }

        if (step === 2) {
            return (
                <form onSubmit={handleSendOTP} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ textAlign: "left" }}>
                        <label style={{ fontSize: "0.85rem", color: "var(--color-text-muted, #94a3b8)", display: "block", marginBottom: "6px" }}>Drop your academic email here</label>
                        <input
                            type="email"
                            placeholder="you@university.edu"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "8px",
                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                background: "var(--color-surface-offset, #161b22)",
                                color: "#fff",
                                outline: "none",
                                fontSize: "0.95rem",
                                boxSizing: "border-box"
                            }}
                        />
                        <span style={{ fontSize: "0.75rem", color: "var(--color-text-faint, #64748b)", display: "block", marginTop: "6px", lineHeight: "1.4" }}>
                            If your institution isn't on our list yet, we'll flag it for admin review and let you know when it's approved.
                        </span>
                    </div>

                    {(localError || error) && (
                        <div style={{ padding: "10px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", color: "#ef4444", fontSize: "0.82rem", textAlign: "left" }}>
                            {localError || error}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                        <button
                            type="button"
                            onClick={() => { setStep(1); setLocalError(""); }}
                            style={{
                                flex: 1,
                                padding: "12px",
                                borderRadius: "8px",
                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                background: "transparent",
                                color: "#94a3b8",
                                cursor: "pointer",
                                fontSize: "0.9rem"
                            }}
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1,
                                padding: "12px",
                                borderRadius: "8px",
                                background: "#f59e0b",
                                border: "none",
                                color: "#000",
                                fontWeight: "600",
                                cursor: "pointer",
                                fontSize: "0.9rem"
                            }}
                        >
                            Send Code
                        </button>
                    </div>
                </form>
            );
        }

        if (step === 3) {
            return (
                <form onSubmit={handleVerifyOTP} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ textAlign: "center" }}>
                        <p style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.9rem", margin: "0 0 16px" }}>
                            We sent a 6-digit code to <strong style={{ color: "var(--color-primary, #3da5d9)" }}>{email}</strong>. Check your spam if it's not there, our mail server can be dramatic.
                        </p>
                        <input
                            type="text"
                            maxLength={6}
                            placeholder="000000"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            required
                            style={{
                                width: "220px",
                                textAlign: "center",
                                padding: "14px",
                                borderRadius: "8px",
                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                background: "var(--color-surface-offset, #161b22)",
                                color: "#f59e0b",
                                outline: "none",
                                fontSize: "1.6rem",
                                fontWeight: "700",
                                letterSpacing: "8px",
                                boxSizing: "border-box"
                            }}
                        />
                    </div>

                    {(localError || error) && (
                        <div style={{ padding: "10px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", color: "#ef4444", fontSize: "0.82rem", textAlign: "left" }}>
                            {localError || error}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                        <button
                            type="button"
                            onClick={() => { setStep(2); setLocalError(""); setOtp(""); }}
                            style={{
                                flex: 1,
                                padding: "12px",
                                borderRadius: "8px",
                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                background: "transparent",
                                color: "#94a3b8",
                                cursor: "pointer",
                                fontSize: "0.9rem"
                            }}
                        >
                            Change Email
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1,
                                padding: "12px",
                                borderRadius: "8px",
                                background: "#f59e0b",
                                border: "none",
                                color: "#000",
                                fontWeight: "600",
                                cursor: "pointer",
                                fontSize: "0.9rem"
                            }}
                        >
                            Verify Code
                        </button>
                    </div>
                </form>
            );
        }

        if (step === 4) {
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--color-surface-offset, #161b22)", border: "1px solid rgba(245, 158, 11, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                        <ShieldCheck size={28} style={{ color: "#f59e0b" }} />
                    </div>
                    <h3 style={{ margin: 0, color: "#fff", fontSize: "1.1rem", fontWeight: "600" }}>Admins are looking at this...</h3>
                    <p style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.88rem", lineHeight: "1.5", margin: 0 }}>
                        Your college domain <strong style={{ color: "#fff" }}>@{email.split("@")[1]}</strong> isn't on our whitelist yet. It's been sent to our admins for review.
                    </p>
                    <p style={{ color: "var(--color-text-faint, #64748b)", fontSize: "0.8rem", lineHeight: "1.4", margin: 0 }}>
                        We'll notify your ZenChat account once they've approved it.
                    </p>
 
                    <button
                        onClick={onClose}
                        style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "8px",
                            background: "var(--color-surface-offset, #161b22)",
                            border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                            color: "#fff",
                            fontWeight: "600",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            marginTop: "12px"
                        }}
                    >
                        Okay, Got It
                    </button>
                </div>
            );
        }

        if (step === 5) {
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "10px 0" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <CheckCircle2 size={44} style={{ color: "#10b981" }} />
                        <h3 style={{ margin: "6px 0 0", color: "#fff", fontSize: "1.2rem", fontWeight: "700" }}>You're in!</h3>
                    </div>
 
                    <div style={{ background: "var(--color-surface-offset, #161b22)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.06))", borderRadius: "12px", padding: "20px", textAlign: "center" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)", display: "block", marginBottom: "8px" }}>YOUR PSEUDONYM</span>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: pseudonymColor || "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ color: "#000", fontWeight: "bold", fontSize: "0.9rem" }}>{pseudonym ? pseudonym.slice(0, 2).toUpperCase() : ""}</span>
                            </div>
                            <span style={{ fontSize: "1.3rem", fontWeight: "700", color: "#fff" }}>{pseudonym}</span>
                        </div>
                        <span style={{ fontSize: "0.82rem", color: "var(--color-text-faint, #64748b)" }}>{collegeName}</span>
                    </div>
 
                    <div style={{ background: "var(--color-surface-offset, #161b22)", borderLeft: "3px solid #f59e0b", padding: "12px 16px", borderRadius: "6px", fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)", textAlign: "left", lineHeight: "1.4" }}>
                        <strong style={{ color: "#fff", display: "block", marginBottom: "2px" }}>No link to your real identity.</strong>
                        Your name and profile stay completely separate. Messages reset daily at 8 AM, so nothing sticks around.
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            width: "100%",
                            padding: "14px",
                            borderRadius: "8px",
                            background: "#f59e0b",
                            border: "none",
                            color: "#000",
                            fontWeight: "700",
                            cursor: "pointer",
                            fontSize: "0.95rem"
                        }}
                    >
                        Browse Rooms
                    </button>
                </div>
            );
        }
    };

    if (isMobile) {
        return createPortal(
            <div className="mobile-bottom-sheet-overlay" style={{ zIndex: 100000 }}>
                <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "88vh", padding: "20px 0 28px" }}>
                    <div style={{ padding: "0 20px" }}>
                        {renderHeader()}
                        <div style={{ marginTop: "20px" }}>
                            {renderContent()}
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="admin-modal-overlay" style={{ zIndex: 100000 }}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px", borderRadius: "16px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px" }}>
                {renderHeader()}
                <div className="admin-body" style={{ padding: 0, marginTop: "20px" }}>
                    {renderContent()}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ZenVoiceVerifyModal;
