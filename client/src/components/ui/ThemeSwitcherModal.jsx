import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";

const PaletteIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
);

const LockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
);

const XIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
);

const ThemeSwitcherModal = ({ isOpen, onClose }) => {
    const { user, updateTheme } = useAuthStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !user || !mounted) return null;

    const streak = user.pulseStreak?.current || 0;
    const referrals = user.referralStats?.registrations || 0;
    const isUnlocked = user.notificationsEnabled && (streak >= 7 || referrals >= 1);

    const handleThemeChange = async (theme) => {
        if (theme !== "default" && !isUnlocked) return;
        await updateTheme(theme);
    };

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100000, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div 
                className="modal-card" 
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    maxWidth: "450px", 
                    width: "100%", 
                    maxHeight: "85vh", 
                    display: "flex", 
                    flexDirection: "column", 
                    padding: 0, 
                    background: "var(--color-surface, rgba(15, 23, 42, 0.95))", 
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "16px",
                    overflow: "hidden"
                }}
            >
                {/* Header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-surface)", position: "sticky", top: 0, zIndex: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ padding: "8px", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <PaletteIcon />
                        </div>
                        <h2 style={{ margin: 0, color: "var(--color-text, #f8fafc)", fontSize: "1.2rem", fontWeight: "600" }}>Themes</h2>
                    </div>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--color-text-muted, #94a3b8)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-text, #fff)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-text-muted, #94a3b8)"}>
                        <XIcon />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                    {!isUnlocked && (
                        <div style={{ padding: "14px", background: "rgba(249, 115, 22, 0.1)", border: "1px solid rgba(249, 115, 22, 0.2)", borderRadius: "12px", color: "#fdba74", fontSize: "0.85rem", lineHeight: "1.5" }}>
                            <strong style={{ display: "block", marginBottom: "4px" }}>Exclusive Themes Locked!</strong>
                            Enable push notifications in your current device & have a current streak of 7+ days on ZenPulse (or) one successful referral to ZenChat, to unlock exclusive themes!
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {/* Default Theme */}
                        <div
                            onClick={() => handleThemeChange("default")}
                            style={{
                                padding: "16px",
                                borderRadius: "12px",
                                border: (user.selectedTheme === "default" || !user.selectedTheme) ? "2px solid var(--color-primary, #38bdf8)" : "2px solid rgba(255,255,255,0.05)",
                                background: (user.selectedTheme === "default" || !user.selectedTheme) ? "rgba(56, 189, 248, 0.05)" : "var(--color-surface-offset, rgba(255,255,255,0.02))",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ fontWeight: "600", color: "var(--color-text, #fff)" }}>Classic Default</span>
                                {(user.selectedTheme === "default" || !user.selectedTheme) && (
                                    <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-primary, #38bdf8)", background: "rgba(56, 189, 248, 0.1)", padding: "2px 6px", borderRadius: "6px" }}>Active</span>
                                )}
                            </div>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted, #94a3b8)", lineHeight: "1.4" }}>The original ZenChat experience.</p>
                        </div>

                        {/* #ZenOLED Theme */}
                        <div
                            onClick={() => handleThemeChange("zen_oled")}
                            style={{
                                padding: "16px",
                                borderRadius: "12px",
                                border: !isUnlocked ? "2px solid rgba(255,255,255,0.05)" : user.selectedTheme === "zen_oled" ? "2px solid #5eead4" : "2px solid rgba(255,255,255,0.05)",
                                background: !isUnlocked ? "var(--color-surface-offset, rgba(255,255,255,0.02))" : user.selectedTheme === "zen_oled" ? "rgba(94, 234, 212, 0.05)" : "var(--color-surface-offset, rgba(255,255,255,0.02))",
                                cursor: !isUnlocked ? "not-allowed" : "pointer",
                                opacity: !isUnlocked ? 0.6 : 1,
                                filter: !isUnlocked ? "grayscale(100%)" : "none",
                                transition: "all 0.2s"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ fontWeight: "600", color: "var(--color-text, #fff)" }}>#ZenOLED</span>
                                {!isUnlocked ? (
                                    <span style={{ color: "var(--color-text-muted, #94a3b8)" }}><LockIcon /></span>
                                ) : user.selectedTheme === "zen_oled" ? (
                                    <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#5eead4", background: "rgba(94, 234, 212, 0.1)", padding: "2px 6px", borderRadius: "6px" }}>Active</span>
                                ) : null}
                            </div>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted, #94a3b8)", lineHeight: "1.4" }}>Deep obsidian blacks with animated glowing chat bubbles. Perfect for OLED screens.</p>
                        </div>

                        {/* Earthy Calm Theme */}
                        <div
                            onClick={() => handleThemeChange("earthy_calm")}
                            style={{
                                padding: "16px",
                                borderRadius: "12px",
                                border: !isUnlocked ? "2px solid rgba(255,255,255,0.05)" : user.selectedTheme === "earthy_calm" ? "2px solid #6B8E6B" : "2px solid rgba(255,255,255,0.05)",
                                background: !isUnlocked ? "var(--color-surface-offset, rgba(255,255,255,0.02))" : user.selectedTheme === "earthy_calm" ? "rgba(107, 142, 107, 0.05)" : "var(--color-surface-offset, rgba(255,255,255,0.02))",
                                cursor: !isUnlocked ? "not-allowed" : "pointer",
                                opacity: !isUnlocked ? 0.6 : 1,
                                filter: !isUnlocked ? "grayscale(100%)" : "none",
                                transition: "all 0.2s"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ fontWeight: "600", color: "var(--color-text, #fff)" }}>Earthy Calm</span>
                                {!isUnlocked ? (
                                    <span style={{ color: "var(--color-text-muted, #94a3b8)" }}><LockIcon /></span>
                                ) : user.selectedTheme === "earthy_calm" ? (
                                    <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#6B8E6B", background: "rgba(107, 142, 107, 0.1)", padding: "2px 6px", borderRadius: "6px" }}>Active</span>
                                ) : null}
                            </div>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted, #94a3b8)", lineHeight: "1.4" }}>Warm off-white and sage green tones for a grounding, natural experience.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ThemeSwitcherModal;
