import React from "react";
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

    if (!isOpen || !user) return null;

    const streak = user.pulseStreak?.current || 0;
    const referrals = user.referralStats?.registrations || 0;
    const isUnlocked = user.notificationsEnabled && (streak >= 7 || referrals >= 1);

    const handleThemeChange = async (theme) => {
        if (theme !== "default" && !isUnlocked) return;
        await updateTheme(theme);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm">
            <div
                className="w-full sm:w-[450px] bg-surface rounded-t-2xl sm:rounded-2xl border-t sm:border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: "85vh" }}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-surface/95 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                            <PaletteIcon />
                        </div>
                        <h2 className="text-xl font-bold">Themes</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-muted hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <XIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {!isUnlocked && (
                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-200 text-sm mb-4">
                            <strong>Exclusive Themes Locked!</strong><br />
                            Enable push notifications in your current device & have a current streak of 7+ days on ZenPulse (or) one successful referral to ZenChat, to unlock exclusive themes!
                        </div>
                    )}

                    <div className="grid gap-4">
                        {/* Default Theme */}
                        <div
                            onClick={() => handleThemeChange("default")}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${user.selectedTheme === "default" || !user.selectedTheme ? "border-primary bg-primary/5" : "border-white/5 hover:border-white/20 bg-surface-offset"}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold">Classic Default</span>
                                {(user.selectedTheme === "default" || !user.selectedTheme) && (
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">Active</span>
                                )}
                            </div>
                            <p className="text-sm text-text-muted mt-1">The original ZenChat experience.</p>
                        </div>

                        {/* #ZenOLED Theme */}
                        <div
                            onClick={() => handleThemeChange("zen_oled")}
                            className={`p-4 rounded-xl border-2 transition-all ${
                                !isUnlocked ? "opacity-50 cursor-not-allowed border-white/5 bg-surface-offset grayscale" :
                                user.selectedTheme === "zen_oled" ? "border-[#5eead4] bg-[#5eead4]/5 cursor-pointer" : "border-white/5 hover:border-white/20 bg-surface-offset cursor-pointer"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-white">#ZenOLED</span>
                                {!isUnlocked ? (
                                    <LockIcon className="text-text-muted" />
                                ) : user.selectedTheme === "zen_oled" ? (
                                    <span className="text-xs font-bold text-[#5eead4] bg-[#5eead4]/10 px-2 py-1 rounded-md">Active</span>
                                ) : null}
                            </div>
                            <p className="text-sm text-text-muted mt-1">Deep obsidian blacks with animated glowing chat bubbles. Perfect for OLED screens.</p>
                        </div>

                        {/* Earthy Calm Theme */}
                        <div
                            onClick={() => handleThemeChange("earthy_calm")}
                            className={`p-4 rounded-xl border-2 transition-all ${
                                !isUnlocked ? "opacity-50 cursor-not-allowed border-white/5 bg-surface-offset grayscale" :
                                user.selectedTheme === "earthy_calm" ? "border-[#6B8E6B] bg-[#6B8E6B]/5 cursor-pointer" : "border-white/5 hover:border-white/20 bg-surface-offset cursor-pointer"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#fdfbf7]">Earthy Calm</span>
                                {!isUnlocked ? (
                                    <LockIcon className="text-text-muted" />
                                ) : user.selectedTheme === "earthy_calm" ? (
                                    <span className="text-xs font-bold text-[#6B8E6B] bg-[#6B8E6B]/10 px-2 py-1 rounded-md">Active</span>
                                ) : null}
                            </div>
                            <p className="text-sm text-text-muted mt-1">Warm off-white and sage green tones for a grounding, natural experience.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeSwitcherModal;
