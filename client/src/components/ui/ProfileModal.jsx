import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { requestNotificationPermission } from "../../utils/firebase";
import axiosInstance from "../../utils/axios";
import LoadingOverlay from "./LoadingOverlay";
import { db } from "../../db/zenDB";
import { generateRecoveryKey, rotateUserRecoveryKey, setupE2EEForUser } from "../../utils/e2eeHelper";

const countryCodes = [
    { code: "+1", label: "US/CA (+1)" },
    { code: "+91", label: "IN (+91)" },
    { code: "+44", label: "UK (+44)" },
    { code: "+61", label: "AU (+61)" },
    { code: "+81", label: "JP (+81)" },
    { code: "+49", label: "DE (+49)" },
    { code: "+33", label: "FR (+33)" },
    { code: "+86", label: "CN (+86)" },
    { code: "+7", label: "RU (+7)" },
    { code: "+55", label: "BR (+55)" }
];

const parsePhone = (phone) => {
    if (!phone) return { code: "+1", body: "" };
    const matchingCode = countryCodes.find(c => phone.startsWith(c.code));
    if (matchingCode) {
        return { code: matchingCode.code, body: phone.substring(matchingCode.code.length) };
    }
    return { code: "+1", body: phone };
};

const ProfileModal = ({ isOpen, onClose, onSave }) => {
    const { user, updateProfile, isLoading, soundEnabled, toggleSound, unblockUser } = useAuthStore();
    const { chats } = useChatStore();
    const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);

    const [username, setUsername] = useState(user?.username || "");
    const [fullName, setFullName] = useState(user?.fullName || "");
    const [email, setEmail] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
    const [onlineVisibility, setOnlineVisibility] = useState(user?.privacySettings?.onlineStatus || "everyone");
    const [nameVisibility, setNameVisibility] = useState(user?.privacySettings?.fullName || "everyone");
    const [avatarVisibility, setAvatarVisibility] = useState(user?.privacySettings?.avatar || "everyone");
    const [typingVisibility, setTypingVisibility] = useState(user?.privacySettings?.typingIndicator || "everyone");
    const [toast, setToast] = useState(null);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [showKeyText, setShowKeyText] = useState(false);
    const [recoveryKeyText, setRecoveryKeyText] = useState("");
    const [isE2EELoading, setIsE2EELoading] = useState(false);
    const [activationPassword, setActivationPassword] = useState("");
    const [showActivationPassword, setShowActivationPassword] = useState(false);
    const [isConfirmingRotate, setIsConfirmingRotate] = useState(false);
    const [localKeysMissing, setLocalKeysMissing] = useState(false);
    const [profileBlockError, setProfileBlockError] = useState(null);
    const initialPhone = parsePhone(user?.phoneNumber);
    const [countryCode, setCountryCode] = useState(initialPhone.code);
    const [phoneBody, setPhoneBody] = useState(initialPhone.body);
    const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
    const [is2faEnabled, setIs2faEnabled] = useState(user?.is2faEnabled || false);
    const [mfaPreference, setMfaPreference] = useState((user?.phoneNumber && !user?.email) ? "email" : "phone");
    const [otpCode, setOtpCode] = useState("");
    const [otpSent, setOtpSent] = useState(false);

    const fileInputRef = useRef(null);
    const importInputRef = useRef(null);

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (isOpen && user) {
            setUsername(user.username || "");
            setFullName(user.fullName || "");
            setEmail(user.email || "");
            setPassword("");
            setAvatarPreview(user.avatar || "");
            setOnlineVisibility(user.privacySettings?.onlineStatus || "everyone");
            setNameVisibility(user.privacySettings?.fullName || "everyone");
            setTypingVisibility(user.privacySettings?.typingIndicator || "everyone");
            setAvatarVisibility(user.privacySettings?.avatar || "everyone");
            setAvatarFile(null);
            setToast(null);
            setIsSubscribing(false);
            setImageError(false);
            setProfileBlockError(null);
            setPhoneNumber(user.phoneNumber || "");
            setIs2faEnabled(user.is2faEnabled || false);
            setMfaPreference((user.phoneNumber && !user.email) ? "email" : "phone");
            
            const parsed = parsePhone(user.phoneNumber);
            setCountryCode(parsed.code);
            setPhoneBody(parsed.body);
            setOtpSent(false);
            setOtpCode("");
        }
    }, [isOpen, user?._id]);

    useEffect(() => {
        if (isOpen) {
            (async () => {
                if (db && db.keys) {
                    const privateKey = await db.keys.get("privateKey");
                    const keyData = await db.keys.get("recoveryKey");
                    setRecoveryKeyText(keyData ? keyData.value : "");
                    setLocalKeysMissing(!privateKey);
                } else {
                    setLocalKeysMissing(true);
                }
            })();
            setShowKeyText(false);
            setIsConfirmingRotate(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    useEffect(() => {
        return () => {
            if (avatarPreview && avatarPreview.startsWith("blob:")) {
                URL.revokeObjectURL(avatarPreview);
            }
        };
    }, [avatarPreview]);

    if (!isOpen) return null;

    const handleUnblockFromProfile = async (targetId) => {
        setProfileBlockError(null);
        const res = await unblockUser(targetId);
        if (!res.success) {
            setProfileBlockError(res.message);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                showToast("Please select an image file.");
                return;
            }
            if (file.size > 7 * 1024 * 1024) {
                showToast("Image too large. Max 7MB.");
                return;
            }
            setAvatarFile(file);
            const url = URL.createObjectURL(file);
            setAvatarPreview(url);
            setImageError(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setToast(null);
        if (password) {
            if (password.length < 7) { showToast("Password must be at least 7 characters."); return; }
            if (password.length > 18) { showToast("Password must be at most 18 characters."); return; }
            if (!/\d/.test(password)) { showToast("Password must contain one number."); return; }
        }
        const formData = new FormData();
        if (username !== user.username) formData.append("username", username);
        if (fullName !== user.fullName) formData.append("fullName", fullName);
        if (email !== user.email) formData.append("email", email);
        if (password) formData.append("password", password);
        if (avatarFile) {
            formData.append("avatar", avatarFile);
        } else if (!avatarPreview) {
            formData.append("clearAvatar", "true");
        }
        if (phoneNumber !== (user.phoneNumber || "")) formData.append("phoneNumber", phoneNumber);
        formData.append("is2faEnabled", is2faEnabled ? "true" : "false");
        formData.append("mfaPreference", mfaPreference);

        const privacySettings = { 
            onlineStatus: onlineVisibility, 
            fullName: nameVisibility,
            avatar: avatarVisibility,
            typingIndicator: typingVisibility 
        };
        formData.append("privacySettings", JSON.stringify(privacySettings));
        const res = await updateProfile(formData);
        if (res.success) {
            showToast("Profile updated successfully.");
            setTimeout(() => {
                onSave?.();
                onClose();
            }, 1000);
        } else {
            showToast(res.message);
        }
    };

    const handleSendVerificationCode = async () => {
        if (mfaPreference === "phone" && !phoneBody.trim()) {
            showToast("Please enter a valid phone number.");
            return;
        }
        if (mfaPreference === "email" && !email.trim()) {
            showToast("Please enter a valid email address.");
            return;
        }
        setIsE2EELoading(true);
        const fullPhone = mfaPreference === "phone" ? (countryCode + phoneBody.trim()) : "";
        try {
            const { data } = await axiosInstance.post("/auth/2fa/setup/request", {
                phoneNumber: fullPhone,
                email: mfaPreference === "email" ? email.trim() : undefined,
                mfaPreference
            });

            if (mfaPreference === "phone") {
                try {
                    const { auth: clientAuth } = await import("../../utils/firebase");
                    const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
                    
                    let verifier = window.recaptchaVerifier;
                    if (!verifier) {
                        verifier = new RecaptchaVerifier(clientAuth, 'recaptcha-container', {
                            size: 'invisible'
                        });
                        window.recaptchaVerifier = verifier;
                    }

                    const confirmation = await signInWithPhoneNumber(clientAuth, fullPhone, verifier);
                    window.confirmationResult = confirmation;
                    showToast(`Verification code sent to ${fullPhone}`);
                    setOtpSent(true);
                } catch (fbErr) {
                    console.warn("Firebase 2FA Auth dispatch failed, falling back to mock gateway:", fbErr.message);
                    window.confirmationResult = null;
                    showToast(data.message || "Verification code sent (mock mode).");
                    setOtpSent(true);
                }
            } else {
                showToast(data.message || "Verification code sent to your email.");
                setOtpSent(true);
            }
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to initiate verification.");
        } finally {
            setIsE2EELoading(false);
        }
    };

    const handleVerifyAndEnable2fa = async (e) => {
        e.preventDefault();
        if (!otpCode.trim()) return;
        setIsE2EELoading(true);
        try {
            const fullPhone = mfaPreference === "phone" ? (countryCode + phoneBody.trim()) : "";
            
            let firebaseToken = null;
            if (mfaPreference === "phone" && window.confirmationResult) {
                try {
                    const result = await window.confirmationResult.confirm(otpCode.trim());
                    firebaseToken = await result.user.getIdToken();
                } catch (fbErr) {
                    showToast("Invalid verification code");
                    setIsE2EELoading(false);
                    return;
                }
            }

            const { data } = await axiosInstance.post("/auth/2fa/setup/verify", {
                otpCode: otpCode.trim(),
                phoneNumber: fullPhone,
                email: mfaPreference === "email" ? email.trim() : undefined,
                mfaPreference,
                firebaseToken
            });
            if (data.user) {
                useAuthStore.getState().updateUser(data.user);
                localStorage.setItem("zenchat_user", JSON.stringify(data.user));
            }
            setIs2faEnabled(true);
            setOtpSent(false);
            setOtpCode("");
            showToast("2FA verified and enabled successfully!");
        } catch (err) {
            showToast(err.response?.data?.message || "Verification failed. Please check the code.");
        } finally {
            setIsE2EELoading(false);
        }
    };

    const handleDisable2fa = async () => {
        setIsE2EELoading(true);
        try {
            const { data } = await axiosInstance.put("/auth/me", {
                is2faEnabled: false
            });
            if (data.user) {
                useAuthStore.getState().updateUser(data.user);
                localStorage.setItem("zenchat_user", JSON.stringify(data.user));
            }
            setIs2faEnabled(false);
            setOtpSent(false);
            showToast("2FA disabled.");
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to disable 2FA.");
        } finally {
            setIsE2EELoading(false);
        }
    };

    const handleExport = () => {
        const messages = useChatStore.getState().messages;
        const exportData = {
            chats: chats.map(c => ({
                id: c._id,
                updatedAt: c.updatedAt,
                messages: messages[c._id]?.map(m => ({
                    sender: m.senderId?.username || m.senderId,
                    content: m.content,
                    type: m.type,
                    media: m.mediaUrl ? "media missing" : null,
                    createdAt: m.createdAt
                })) || []
            }))
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `zenchat_export_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Export downloaded.");
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!data?.chats || !Array.isArray(data.chats)) {
                    showToast("Invalid export file.");
                    return;
                }
                showToast(`Read-only archive loaded - ${data.chats.length} chat(s) found. Use in-app chat history to view messages.`);
            } catch {
                showToast("Could not parse file. Make sure it is a valid ZenChat export.");
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const handleSubscribe = async () => {
        setIsSubscribing(true);
        setToast(null);
        try {
            if (!('Notification' in window)) {
                showToast("Notifications not supported.");
                setIsSubscribing(false);
                return;
            }
            if (typeof window.Notification !== 'undefined' && window.Notification.permission === "denied") {
                showToast("Notifications blocked in browser settings.");
                setIsSubscribing(false);
                return;
            }

            // Small delay to ensure the LoadingOverlay renders before the native prompt
            await new Promise(resolve => setTimeout(resolve, 250));

            const token = await requestNotificationPermission();
            if (token) {
                const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
                const { data } = await axiosInstance.put("/auth/me", {
                    notificationsEnabled: true,
                    fcmToken: token,
                    deviceType: isPWA ? "pwa" : "browser"
                });
                if (data?.user) {
                    useAuthStore.getState().updateUser(data.user);
                    localStorage.setItem("zenchat_user", JSON.stringify(data.user));
                    showToast("Notifications enabled.");
                }
            } else {
                showToast("Could not get push token.");
            }
        } catch (err) {
            console.error("Sub error:", err);
            showToast("Failed to enable notifications.");
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleShowRecoveryKey = () => {
        setShowKeyText(!showKeyText);
    };

    const handleRotateRecoveryKey = async () => {
        if (!isConfirmingRotate) {
            setIsConfirmingRotate(true);
            return;
        }

        setIsConfirmingRotate(false);
        setIsE2EELoading(true);
        try {
            const newKey = generateRecoveryKey();
            await rotateUserRecoveryKey(user, newKey);
            setRecoveryKeyText(newKey);
            showToast("New Recovery Key successfully generated and cached.");
        } catch (err) {
            console.error("[Settings] Rotation failed:", err);
            showToast("Key generation failed. Make sure E2EE is active on this device.");
        } finally {
            setIsE2EELoading(false);
        }
    };

    const handleActivateE2EE = async () => {
        if (!activationPassword) {
            showToast("Please enter your password to activate E2EE.");
            return;
        }
        setIsE2EELoading(true);
        try {
            const recoveryKey = await setupE2EEForUser(user, activationPassword);
            
            if (db && db.keys) {
                const privateKey = await db.keys.get("privateKey");
                const keyData = await db.keys.get("recoveryKey");
                setRecoveryKeyText(keyData ? keyData.value : (recoveryKey || ""));
                setLocalKeysMissing(!privateKey);
            }
            
            const { checkAuth } = useAuthStore.getState();
            await checkAuth();
            
            showToast("End-to-End Encryption activated successfully.");
            setActivationPassword("");
        } catch (err) {
            console.error("[ProfileModal] Activation failed:", err);
            showToast("Activation failed. Verify your password and try again.");
        } finally {
            setIsE2EELoading(false);
        }
    };

    const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : "??";
    const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    const currentDeviceType = isPWA ? "pwa" : "browser";
    const isSubscribedInBrowser = typeof window.Notification !== 'undefined' && window.Notification.permission === "granted" && 
                                   user?.fcmTokens?.some(t => t.deviceType === currentDeviceType);

    return createPortal(
        <div className="modal-overlay moments-aura-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            {toast && <div className="aura-toast" style={{ zIndex: 10001, bottom: '20px' }}>{toast}</div>}
            {isSubscribing && <LoadingOverlay message="Subscribing..." subMessage="Setting up your secure connection" />}
            {isE2EELoading && <LoadingOverlay message="Generating key..." subMessage="Performing zero-knowledge cryptographic operations" />}
            <div className="moments-aura-content profile-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px", width: "95%", padding: 0 }}>
                <div className="moments-aura-header">
                    <h2 className="moments-aura-title">Profile & Settings</h2>
                    <button className="aura-close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div style={{ padding: '24px' }}>


                <form onSubmit={handleSubmit} className="profile-form">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', marginTop: '0.25rem' }}>
                        <div className="profile-avatar-container">
                            <div
                                className="avatar profile-avatar-edit"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {(avatarPreview && !imageError) ? (
                                    <img
                                        src={avatarPreview}
                                        alt="Avatar preview"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <span>{getInitials(username || user?.username || "??")}</span>
                                )}
                                <div className="avatar-edit-overlay">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                        <circle cx="12" cy="13" r="4" />
                                    </svg>
                                </div>
                            </div>
                            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
                            {avatarPreview && (
                                <button
                                    type="button"
                                    className="avatar-reset-btn"
                                    onClick={() => { setAvatarFile(null); setAvatarPreview(""); }}
                                    title="Remove photo"
                                >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div className="form-group">
                            <label>Username</label>
                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Full Name</label>
                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Display name" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>

                    <div className="form-group">
                        <label>New Password (optional)</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="7-18 chars, one number"
                            minLength={7}
                            maxLength={18}
                        />
                        {password && (() => {
                            if (password.length < 7) return <span className="field-hint field-hint-error">At least 7 characters</span>;
                            if (password.length > 18) return <span className="field-hint field-hint-error">At most 18 characters</span>;
                            if (!/\d/.test(password)) return <span className="field-hint field-hint-error">Must contain at least one number</span>;
                            return <span className="field-hint field-hint-ok">Password looks good</span>;
                        })()}
                    </div>

                    <div className="privacy-section" style={{ marginTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.25rem" }}>
                        <h3 style={{ fontSize: "0.85rem", marginBottom: "1rem", color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Privacy</h3>
                        <div className="form-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem" }}>
                            <div className="form-group">
                                <label>Online Status</label>
                                <select value={onlineVisibility} onChange={(e) => setOnlineVisibility(e.target.value)}>
                                    <option value="everyone">Everyone</option>
                                    <option value="contacts">Contacts Only</option>
                                    <option value="nobody">Nobody</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Full Name</label>
                                <select value={nameVisibility} onChange={(e) => setNameVisibility(e.target.value)}>
                                    <option value="everyone">Everyone</option>
                                    <option value="contacts">Contacts Only</option>
                                    <option value="nobody">Nobody</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Avatar Visibility</label>
                                <select value={avatarVisibility} onChange={(e) => setAvatarVisibility(e.target.value)}>
                                    <option value="everyone">Everyone</option>
                                    <option value="contacts">Contacts Only</option>
                                    <option value="nobody">Nobody</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: "1rem" }}>
                            <label>Scrambled Typing Preview</label>
                            <select value={typingVisibility} onChange={(e) => setTypingVisibility(e.target.value)}>
                                <option value="everyone">Everyone</option>
                                <option value="contacts">Contacts Only</option>
                                <option value="nobody">Nobody</option>
                            </select>
                            <span style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "4px", display: "block", lineHeight: "1.2" }}>
                                Only if both sender and receiver have set the same visibility level, scrambled preview is rendered. Otherwise, standard indicators are used.
                            </span>
                        </div>
                    </div>

                    <div className="profile-settings-row" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "0.85rem" }}>
                                    <span>SmartPayload-OPtimization (#SP-OP)</span>
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: isLowBandwidth ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                                        color: isLowBandwidth ? '#eab308' : '#94a3b8',
                                        fontWeight: '800',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {isLowBandwidth ? "Active" : "OFF"}
                                    </span>
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginTop: "4px", lineHeight: "1.3" }}>
                                    {isLowBandwidth 
                                        ? "Currently active to prevent network congestion by delaying media auto-downloads and throttling typing sockets." 
                                        : "Safeguards bandwidth automatically on 2G/3G connections and slow round-trip response states."
                                    }
                                </span>
                            </div>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "0.72rem",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.05)",
                                color: "#94a3b8",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px"
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#38bdf8" }}>
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                                Auto-Managed
                            </div>
                        </div>
                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem" }}>Two-Factor Authentication (2FA)</span>
                                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Secure your account using SMS/Email OTP</span>
                            </div>

                            {is2faEnabled ? (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)", padding: "10px 14px", borderRadius: "8px", marginTop: "4px" }}>
                                    <div>
                                        <div style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                                            2FA is Active
                                        </div>
                                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>
                                            Preference: {mfaPreference === "phone" ? `Phone SMS (${user?.phoneNumber || ""})` : `Email (${user?.email || ""})`}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDisable2fa}
                                        style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", padding: "6px 12px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                                    >
                                        Disable 2FA
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>Select 2FA Method</label>
                                        {mfaPreference === "email" ? (
                                            <div style={{
                                                background: "rgba(255, 255, 255, 0.04)",
                                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                                borderRadius: "8px",
                                                padding: "10px",
                                                fontSize: "0.8rem",
                                                color: "#fff",
                                                fontWeight: "500"
                                            }}>
                                                Email Verification Code (Sends verification to email)
                                            </div>
                                        ) : (
                                            <div style={{
                                                background: "rgba(255, 255, 255, 0.04)",
                                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                                borderRadius: "8px",
                                                padding: "10px",
                                                fontSize: "0.8rem",
                                                color: "#fff",
                                                fontWeight: "500"
                                            }}>
                                                Phone SMS OTP (Sends OTP via SMS)
                                            </div>
                                        )}
                                    </div>

                                    {mfaPreference === "phone" && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                            <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>Phone Number</label>
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <select
                                                    value={countryCode}
                                                    onChange={(e) => setCountryCode(e.target.value)}
                                                    style={{
                                                        width: "95px",
                                                        background: "rgba(0, 0, 0, 0.3)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        borderRadius: "8px",
                                                        padding: "8px",
                                                        fontSize: "0.8rem",
                                                        color: "#fff"
                                                    }}
                                                >
                                                    {countryCodes.map(c => (
                                                        <option key={c.code} value={c.code} style={{ background: "#1e293b", color: "#fff" }}>
                                                            {c.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="tel"
                                                    placeholder="234 567 8900"
                                                    value={phoneBody}
                                                    onChange={(e) => {
                                                        setPhoneBody(e.target.value.replace(/\D/g, ""));
                                                        setOtpSent(false);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        background: "rgba(0, 0, 0, 0.3)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        borderRadius: "8px",
                                                        padding: "8px 12px",
                                                        fontSize: "0.8rem",
                                                        color: "#fff"
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {mfaPreference === "email" && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                            <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>Email Address</label>
                                            <input
                                                type="email"
                                                placeholder="you@example.com"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    setOtpSent(false);
                                                }}
                                                style={{
                                                    background: "rgba(0, 0, 0, 0.3)",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    borderRadius: "8px",
                                                    padding: "8px 12px",
                                                    fontSize: "0.8rem",
                                                    color: "#fff"
                                                }}
                                            />
                                        </div>
                                    )}

                                    {!otpSent ? (
                                        <button
                                            type="button"
                                            onClick={handleSendVerificationCode}
                                            disabled={
                                                (mfaPreference === "phone" && !phoneBody.trim()) ||
                                                (mfaPreference === "email" && !email.trim())
                                            }
                                            style={{ 
                                                background: (
                                                    (mfaPreference === "phone" && !phoneBody.trim()) ||
                                                    (mfaPreference === "email" && !email.trim())
                                                ) ? "rgba(255, 255, 255, 0.05)" : "rgba(61, 165, 217, 0.15)", 
                                                border: (
                                                    (mfaPreference === "phone" && !phoneBody.trim()) ||
                                                    (mfaPreference === "email" && !email.trim())
                                                ) ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(61, 165, 217, 0.3)", 
                                                color: (
                                                    (mfaPreference === "phone" && !phoneBody.trim()) ||
                                                    (mfaPreference === "email" && !email.trim())
                                                ) ? "#64748b" : "var(--color-primary)", 
                                                padding: "8px 16px", 
                                                borderRadius: "8px", 
                                                fontSize: "0.8rem", 
                                                fontWeight: "600", 
                                                cursor: (
                                                    (mfaPreference === "phone" && !phoneBody.trim()) ||
                                                    (mfaPreference === "email" && !email.trim())
                                                ) ? "not-allowed" : "pointer", 
                                                width: "100%", 
                                                marginTop: "4px" 
                                            }}
                                        >
                                            Send Verification Code
                                        </button>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            <label style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: "600" }}>Enter 6-Digit Code Manually</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={6}
                                                placeholder="0 0 0 0 0 0"
                                                value={otpCode}
                                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                                                style={{
                                                    width: "100%",
                                                    background: "rgba(0, 0, 0, 0.3)",
                                                    border: "1px solid rgba(255,255,255,0.15)",
                                                    borderRadius: "8px",
                                                    padding: "10px 12px",
                                                    fontSize: "1.1rem",
                                                    color: "#fff",
                                                    letterSpacing: "8px",
                                                    textAlign: "center",
                                                    fontFamily: "monospace",
                                                    boxSizing: "border-box"
                                                }}
                                            />
                                            <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center", marginTop: "4px" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOtpSent(false);
                                                        setOtpCode("");
                                                    }}
                                                    style={{ 
                                                        flex: 1, 
                                                        maxWidth: "150px", 
                                                        background: "rgba(255,255,255,0.06)", 
                                                        border: "1px solid rgba(255,255,255,0.1)", 
                                                        color: "#fff", 
                                                        padding: "10px 16px", 
                                                        borderRadius: "8px", 
                                                        fontSize: "0.8rem", 
                                                        fontWeight: "600", 
                                                        cursor: "pointer", 
                                                        height: "40px", 
                                                        display: "flex", 
                                                        alignItems: "center", 
                                                        justifyContent: "center" 
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleVerifyAndEnable2fa}
                                                    disabled={otpCode.length < 6 || isE2EELoading}
                                                    style={{ 
                                                        flex: 1, 
                                                        maxWidth: "150px", 
                                                        background: "var(--color-primary)", 
                                                        color: "black", 
                                                        border: "none", 
                                                        padding: "10px 16px", 
                                                        borderRadius: "8px", 
                                                        fontSize: "0.8rem", 
                                                        fontWeight: "700", 
                                                        cursor: "pointer", 
                                                        height: "40px", 
                                                        display: "flex", 
                                                        alignItems: "center", 
                                                        justifyContent: "center", 
                                                        opacity: (otpCode.length < 6 || isE2EELoading) ? 0.5 : 1 
                                                    }}
                                                >
                                                    Verify
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem" }}>Message Sounds</span>
                                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Play sounds for sent/received messages</span>
                            </div>
                            <button
                                type="button"
                                className={`toggle-btn ${soundEnabled ? "toggle-on" : ""}`}
                                onClick={toggleSound}
                                aria-label="Toggle message sounds"
                            >
                                <span className="toggle-thumb" />
                            </button>
                        </div>

                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px" }}>
                            <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Push Notifications</span>
                            {isSubscribedInBrowser ? (
                                <div style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: "500" }}>Subscribed in this browser</div>
                            ) : (
                                <button type="button" className="profile-subscribe-btn" onClick={handleSubscribe} style={{ width: "100%", background: "#3b82f6", color: "white", border: "none", padding: "9px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer" }}>
                                    Enable Push Notifications
                                </button>
                            )}
                        </div>

                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px" }}>
                            <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Blocked Users</span>
                            {(!user?.blockedUsers || user.blockedUsers.length === 0) ? (
                                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>No blocked users.</span>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "0.5rem" }}>
                                    {user.blockedUsers.map((blockedEntry) => {
                                        const targetUser = blockedEntry.userId;
                                        if (!targetUser) return null;
                                        const targetId = targetUser._id || targetUser;
                                        const initials = targetUser.username?.slice(0, 2).toUpperCase() || "?";
                                        return (
                                            <div key={targetId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: "8px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <div className="avatar avatar-sm" style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "600" }}>
                                                        {targetUser.avatar ? (
                                                            <img src={targetUser.avatar} alt={targetUser.username} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                        ) : (
                                                            <span>{initials}</span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: "0.8rem", fontWeight: "500" }}>@{targetUser.username}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUnblockFromProfile(targetId)}
                                                    style={{ background: "rgba(61, 165, 217, 0.15)", border: "none", color: "var(--color-primary)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: "600", cursor: "pointer" }}
                                                >
                                                    Unblock
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {profileBlockError && (
                                <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px' }}>
                                    {profileBlockError}
                                </p>
                            )}
                        </div>

                        {localKeysMissing ? (
                            <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "rgba(3, 105, 161, 0.04)", border: "1px dashed rgba(3, 105, 161, 0.25)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <div>
                                    <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", color: "var(--color-primary)" }}>
                                        Sync E2EE on this Device
                                    </span>
                                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", display: "block", marginTop: "4px", lineHeight: "1.3" }}>
                                        End-to-End Encryption is active on your account, but your secure private key is not cached on this device. Enter your password to synchronize and access your secure chat history.
                                    </span>
                                </div>
                                
                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", alignItems: "center" }}>
                                    <div style={{ position: "relative", flex: 1, display: "flex" }}>
                                        <input
                                            type={showActivationPassword ? "text" : "password"}
                                            placeholder="Enter account password"
                                            value={activationPassword}
                                            onChange={(e) => setActivationPassword(e.target.value)}
                                            style={{ flex: 1, padding: "8px 36px 8px 10px", borderRadius: "8px", background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: "0.78rem", width: "100%" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowActivationPassword(!showActivationPassword)}
                                            style={{
                                                position: "absolute",
                                                right: "10px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                background: "none",
                                                border: "none",
                                                color: "#64748b",
                                                cursor: "pointer",
                                                padding: 0,
                                                display: "flex",
                                                alignItems: "center"
                                            }}
                                            aria-label={showActivationPassword ? "Hide password" : "Show password"}
                                        >
                                            {showActivationPassword ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleActivateE2EE}
                                        style={{ background: "var(--color-primary)", color: "black", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "0.78rem", fontWeight: "700", cursor: "pointer", flexShrink: 0 }}
                                    >
                                        Sync
                                    </button>
                                </div>
                            </div>
                        ) : !user?.publicKey ? (
                            <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "rgba(239, 68, 68, 0.04)", border: "1px dashed rgba(239, 68, 68, 0.2)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <div>
                                    <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", color: "#f87171" }}>
                                        End-to-End Encryption is not active
                                    </span>
                                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", display: "block", marginTop: "4px", lineHeight: "1.3" }}>
                                        To secure your chat messages with zero-knowledge, end-to-end encryption, enter your account password to initialize your secure keypair.
                                    </span>
                                </div>
                                
                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", alignItems: "center" }}>
                                    <div style={{ position: "relative", flex: 1, display: "flex" }}>
                                        <input
                                            type={showActivationPassword ? "text" : "password"}
                                            placeholder="Enter account password"
                                            value={activationPassword}
                                            onChange={(e) => setActivationPassword(e.target.value)}
                                            style={{ flex: 1, padding: "8px 36px 8px 10px", borderRadius: "8px", background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: "0.78rem", width: "100%" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowActivationPassword(!showActivationPassword)}
                                            style={{
                                                position: "absolute",
                                                right: "10px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                background: "none",
                                                border: "none",
                                                color: "#64748b",
                                                cursor: "pointer",
                                                padding: 0,
                                                display: "flex",
                                                alignItems: "center"
                                            }}
                                            aria-label={showActivationPassword ? "Hide password" : "Show password"}
                                        >
                                            {showActivationPassword ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleActivateE2EE}
                                        style={{ background: "var(--color-primary)", color: "black", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "0.78rem", fontWeight: "700", cursor: "pointer", flexShrink: 0 }}
                                    >
                                        Activate
                                    </button>
                                </div>
                                <span style={{ fontSize: "0.7rem", color: "#64748b", fontStyle: "italic", textAlign: "center", display: "block" }}>
                                    (Tip: You can also log out and log back in to activate E2EE automatically)
                                </span>
                            </div>
                        ) : (
                            <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <div>
                                    <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem" }}>E2EE Offline Recovery Key</span>
                                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", display: "block", marginTop: "4px", lineHeight: "1.3" }}>
                                        This key is used to generate your offline recovery key for both caching in local IndexedDB and for you to copy/note down. Keep it safe to restore and access your historical encrypted chats on a new device or if you reset your account password.
                                    </span>
                                </div>
                                
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <button
                                            type="button"
                                            onClick={handleShowRecoveryKey}
                                            style={{ flex: 1, background: "rgba(61, 165, 217, 0.15)", border: "1px solid rgba(61, 165, 217, 0.3)", color: "var(--color-primary)", padding: "7px 12px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                                        >
                                            <span>{showKeyText ? "Hide Recovery Key" : "View Recovery Key"}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRotateRecoveryKey}
                                            style={{
                                                flex: 1,
                                                background: isConfirmingRotate ? "rgba(244, 63, 94, 0.15)" : "rgba(255, 255, 255, 0.04)",
                                                border: isConfirmingRotate ? "1px solid rgba(244, 63, 94, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                                                color: isConfirmingRotate ? "#f43f5e" : "#f1f5f9",
                                                padding: "7px 12px",
                                                borderRadius: "8px",
                                                fontSize: "0.8rem",
                                                fontWeight: "700",
                                                cursor: "pointer",
                                                transition: "all 0.2s ease"
                                            }}
                                        >
                                            {isConfirmingRotate ? "Are you sure? Click again" : "Generate New Key"}
                                        </button>
                                    </div>
                                    
                                    {isConfirmingRotate && (
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(244, 63, 94, 0.08)", border: "1px solid rgba(244, 63, 94, 0.15)", padding: "8px 12px", borderRadius: "8px" }}>
                                            <span style={{ fontSize: "0.72rem", color: "#fda4af", lineHeight: "1.2", maxWidth: "70%" }}>
                                                Warning: This will overwrite your existing online key bundle.
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setIsConfirmingRotate(false)}
                                                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600" }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {showKeyText && (
                                    <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.08)", padding: "12px", borderRadius: "8px", marginTop: "0.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                                        {recoveryKeyText ? (
                                            <>
                                                <span style={{ fontFamily: "monospace", fontSize: "1rem", fontWeight: "700", letterSpacing: "1px", color: "var(--color-primary)" }}>
                                                    {recoveryKeyText}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(recoveryKeyText);
                                                        showToast("Recovery key copied to clipboard.");
                                                    }}
                                                    style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#94a3b8", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "600", cursor: "pointer" }}
                                                >
                                                    Copy Key
                                                </button>
                                            </>
                                        ) : (
                                            <span style={{ fontSize: "0.75rem", color: "#f43f5e" }}>
                                                Recovery key is not cached on this device. Generate a new one to secure your account.
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="actions-section" style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem" }}>
                        <button
                            type="button"
                            onClick={handleExport}
                            style={{
                                flex: 1,
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "#f1f5f9",
                                padding: "10px 16px",
                                borderRadius: "8px",
                                fontSize: "0.82rem",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                                e.currentTarget.style.borderColor = "var(--color-primary)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                            }}
                        >
                            <span>Export Chat History</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => importInputRef.current?.click()}
                            style={{
                                flex: 1,
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "#f1f5f9",
                                padding: "10px 16px",
                                borderRadius: "8px",
                                fontSize: "0.82rem",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                                e.currentTarget.style.borderColor = "var(--color-primary)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                            }}
                        >
                            <span>Import Archive</span>
                        </button>
                        <input ref={importInputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleImport} />
                        <div id="recaptcha-container"></div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: "100%", marginTop: "1rem", padding: "12px" }}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </button>
                </form>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProfileModal;
