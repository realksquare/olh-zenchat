import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";

const RecoveryKeyModal = () => {
    const tempRecoveryKey = useAuthStore((s) => s.tempRecoveryKey);
    const clearTempRecoveryKey = useAuthStore((s) => s.clearTempRecoveryKey);
    const [copied, setCopied] = useState(false);

    if (!tempRecoveryKey) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(tempRecoveryKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy recovery key:", err);
        }
    };

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
            boxSizing: "border-box"
        }}>
            <div style={{
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(56, 189, 248, 0.05)",
                borderRadius: "24px",
                padding: "36px",
                maxWidth: "480px",
                width: "100%",
                boxSizing: "border-box",
                textAlign: "center"
            }}>
                {/* Cryptographic Key Icon Wrapper */}
                <div style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "20px",
                    backgroundColor: "rgba(56, 189, 248, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 24px auto"
                }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>

                <h2 style={{
                    color: "#f1f5f9",
                    fontSize: "24px",
                    fontWeight: "700",
                    margin: "0 0 12px 0",
                    letterSpacing: "-0.5px"
                }}>Your Secure E2EE Recovery Key</h2>

                <p style={{
                    color: "#94a3b8",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    margin: "0 0 28px 0"
                }}>
                    ZenChat uses absolute Zero-Knowledge End-to-End Encryption. If you ever reset your password, you will need this key to successfully restore your history on new devices.
                </p>

                {/* Secure Key Display Container */}
                <div style={{
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "16px",
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    margin: "0 0 24px 0",
                    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.2)"
                }}>
                    <span style={{
                        fontFamily: "'Courier New', Courier, monospace",
                        color: "#38bdf8",
                        fontSize: "20px",
                        fontWeight: "700",
                        letterSpacing: "1.5px"
                    }}>
                        {tempRecoveryKey}
                    </span>

                    <button 
                        onClick={handleCopy}
                        style={{
                            background: copied ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.05)",
                            border: `1px solid ${copied ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
                            borderRadius: "10px",
                            padding: "8px 12px",
                            color: copied ? "#4ade80" : "#cbd5e1",
                            fontSize: "13px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.2s"
                        }}
                    >
                        {copied ? (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                Copy
                            </>
                        )}
                    </button>
                </div>

                {/* Security Warning Notice */}
                <div style={{
                    backgroundColor: "rgba(239, 68, 68, 0.06)",
                    border: "1px solid rgba(239, 68, 68, 0.15)",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    textAlign: "left",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    margin: "0 0 32px 0"
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: "2px" }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span style={{
                        color: "#fca5a5",
                        fontSize: "12.5px",
                        lineHeight: "1.5",
                        fontWeight: "500"
                    }}>
                        Store this key in a secure password manager or offline vault. We do not keep an unencrypted copy on the server, so we cannot recover it for you!
                    </span>
                </div>

                {/* Secure Dismiss Button */}
                <button
                    onClick={clearTempRecoveryKey}
                    style={{
                        width: "100%",
                        background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                        border: "none",
                        borderRadius: "12px",
                        padding: "14px",
                        color: "#ffffff",
                        fontSize: "15px",
                        fontWeight: "600",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                        transition: "all 0.2s"
                    }}
                >
                    I Have Safely Saved It
                </button>
            </div>
        </div>
    );
};

export default RecoveryKeyModal;
