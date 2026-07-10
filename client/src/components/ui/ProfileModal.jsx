import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { requestNotificationPermission } from "../../utils/firebase";
import axiosInstance from "../../utils/axios";
import LoadingOverlay from "./LoadingOverlay";
import { db } from "../../db/zenDB";
import { generateRecoveryKey, rotateUserRecoveryKey, setupE2EEForUser, getLocalE2EEKeys } from "../../utils/e2eeHelper";
import { decryptForMultipleRecipients, decryptFileAES } from "../../utils/crypto";
import MomentViewer from "../chat/MomentViewer";

// Phone parser and country codes removed in favor of Email 2FA

const VISIBILITY_OPTIONS = [
    { value: "everyone", label: "Everyone" },
    { value: "contacts", label: "Contacts Only" },
    { value: "nobody", label: "Nobody" }
];

const CustomSelect = ({ value, onChange, options, isMobile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (isMobile) return;
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMobile]);

    const selectedOption = options.find(o => o.value === value) || options[0];

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: "100%",
                    background: "var(--body-bg, #0e1117)",
                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "0.85rem",
                    color: "#e2e8f0",
                    outline: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    boxSizing: "border-box",
                    height: "40px"
                }}
            >
                <span>{selectedOption.label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>

            {!isMobile && isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        width: "100%",
                        background: "var(--color-surface, #161b22)",
                        border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                        borderRadius: "8px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        zIndex: 1000,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={() => handleSelect(opt.value)}
                            style={{
                                padding: "10px 14px",
                                fontSize: "0.85rem",
                                color: opt.value === value ? "var(--color-primary)" : "#c9d1d9",
                                background: opt.value === value ? "rgba(255, 255, 255, 0.04)" : "transparent",
                                cursor: "pointer",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = opt.value === value ? "rgba(255, 255, 255, 0.04)" : "transparent";
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}

            {isMobile && isOpen && createPortal(
                <div
                    className="mobile-bottom-sheet-overlay"
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(9, 13, 20, 0.72)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        zIndex: 9999999,
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div
                        className="mobile-bottom-sheet"
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            background: "var(--color-surface, linear-gradient(180deg, #1a2030 0%, #161b22 100%))",
                            borderTopLeftRadius: '24px',
                            borderTopRightRadius: '24px',
                            padding: '0 0 env(safe-area-inset-bottom, 24px)',
                            boxShadow: '0 -12px 48px rgba(0,0,0,0.6)',
                            display: 'flex', flexDirection: 'column',
                            animation: 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxSizing: 'border-box',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ padding: "10px 20px 10px", fontSize: "0.95rem", fontWeight: 600, color: "var(--color-text, #fff)" }}>
                            Select Option
                        </div>

                        <div className="mobile-sheet-actions" style={{ display: 'flex', flexDirection: 'column', padding: '8px 0 16px' }}>
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className="bottom-sheet-item"
                                    onClick={() => handleSelect(opt.value)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '14px',
                                        padding: '14px 20px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 0,
                                        color: opt.value === value ? "var(--color-primary)" : '#c9d1d9',
                                        fontSize: '0.93rem',
                                        fontWeight: 500,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s'
                                    }}
                                >
                                    <span>{opt.label}</span>
                                    {opt.value === value && (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-primary)" }}>
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const ImageCropperModal = ({ src, onCrop, onClose }) => {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const imgRef = useRef(null);
    const containerRef = useRef(null);

    const handleTouchStart = (e) => {
        setIsDragging(true);
        dragStart.current = {
            x: e.touches[0].clientX - offset.x,
            y: e.touches[0].clientY - offset.y
        };
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        setOffset({
            x: e.touches[0].clientX - dragStart.current.x,
            y: e.touches[0].clientY - dragStart.current.y
        });
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - offset.x,
            y: e.clientY - offset.y
        };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleSave = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");

        const img = imgRef.current;
        if (!img) return;

        ctx.fillStyle = "#121820";
        ctx.fillRect(0, 0, 300, 300);

        const displayWidth = img.width * zoom;
        const displayHeight = img.height * zoom;

        const destX = 150 + offset.x - displayWidth / 2;
        const destY = 150 + offset.y - displayHeight / 2;

        ctx.drawImage(img, destX, destY, displayWidth, displayHeight);

        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = 256;
        finalCanvas.height = 256;
        const finalCtx = finalCanvas.getContext("2d");
        finalCtx.drawImage(canvas, 50, 50, 200, 200, 0, 0, 256, 256);

        finalCanvas.toBlob((blob) => {
            onCrop(blob);
        }, "image/jpeg", 0.9);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(9, 13, 20, 0.94)',
            zIndex: 9999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }} onClick={e => e.stopPropagation()}>
            <div style={{
                background: 'var(--color-surface, #161b22)', border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))',
                borderRadius: '16px', padding: '24px', maxWidth: '90%', width: '340px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '20px'
            }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text, #fff)' }}>Crop Profile Picture</h3>
                
                <div 
                    ref={containerRef}
                    style={{
                        position: 'relative', width: '300px', height: '300px', background: '#090d14',
                        overflow: 'hidden', borderRadius: '12px', cursor: isDragging ? 'grabbing' : 'grab',
                        touchAction: 'none'
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <img 
                        ref={imgRef}
                        src={src} 
                        alt="Crop preview" 
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                            maxHeight: '100%',
                            maxWidth: '100%',
                            pointerEvents: 'none',
                            userSelect: 'none'
                        }}
                    />
                    <div style={{
                        position: 'absolute', inset: 0,
                        border: '50px solid rgba(0, 0, 0, 0.65)',
                        boxSizing: 'border-box',
                        pointerEvents: 'none'
                    }}>
                        <div style={{
                            width: '200px', height: '200px',
                            border: '2px dashed var(--color-primary, #3da5d9)',
                            borderRadius: '50%',
                            boxSizing: 'border-box',
                            position: 'absolute',
                            left: '-50px',
                            top: '-50px',
                            transform: 'translate(50px, 50px)'
                        }} />
                    </div>
                </div>

                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>Zoom</span>
                    <input 
                        type="range" 
                        min="1" 
                        max="4" 
                        step="0.01" 
                        value={zoom} 
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--color-primary, #3da5d9)' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '4px' }}>
                    <button type="button" className="btn btn-outline btn-full" onClick={onClose} style={{ margin: 0, padding: "10px" }}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-full" onClick={handleSave} style={{ margin: 0, padding: "10px" }}>Crop & Save</button>
                </div>
            </div>
        </div>
    );
};

const ProfileModal = ({ isOpen, onClose, onSave }) => {
    const { user, updateProfile, isLoading, soundEnabled, toggleSound, unblockUser } = useAuthStore();
    const { chats } = useChatStore();
    const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);

    const [activeTab, setActiveTab] = useState("profile");
    const [username, setUsername] = useState(user?.username || "");
    const [fullName, setFullName] = useState(user?.fullName || "");
    const [email, setEmail] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
    const [cropImage, setCropImage] = useState(null);
    const [onlineVisibility, setOnlineVisibility] = useState(user?.privacySettings?.onlineStatus || "everyone");
    const [nameVisibility, setNameVisibility] = useState(user?.privacySettings?.fullName || "everyone");
    const [avatarVisibility, setAvatarVisibility] = useState(user?.privacySettings?.avatar || "everyone");
    const [bio, setBio] = useState(user?.bio || "");
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
    const [is2faEnabled, setIs2faEnabled] = useState(user?.is2faEnabled || false);
    const [otpCode, setOtpCode] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [expiryTimeLeft, setExpiryTimeLeft] = useState(300); // 5 minutes countdown
    const [resendLockTimeLeft, setResendLockTimeLeft] = useState(0); // 30 second rate-limit
    const [resendCount, setResendCount] = useState(0);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        const stateStr = localStorage.getItem("setup_mfa_resend");
        if (stateStr) {
            const state = JSON.parse(stateStr);
            const now = Date.now();
            if (state.lockUntil && now < state.lockUntil) {
                setIsLocked(true);
                setResendLockTimeLeft(Math.ceil((state.lockUntil - now) / 1000));
            } else if (state.lockUntil && now >= state.lockUntil) {
                setIsLocked(false);
                setResendCount(0);
                localStorage.removeItem("setup_mfa_resend");
            } else {
                setResendCount(state.count || 0);
                if (state.lastResend && now - state.lastResend < 30000) {
                    setResendLockTimeLeft(Math.ceil((30000 - (now - state.lastResend)) / 1000));
                }
            }
        }
    }, []);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [capturedMoments, setCapturedMoments] = useState([]);
    const [viewerMoment, setViewerMoment] = useState(null);
    const [loadingMoments, setLoadingMoments] = useState(false);
    const [momentToDelete, setMomentToDelete] = useState(null);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        let timer = null;
        if (otpSent) {
            timer = setInterval(() => {
                setExpiryTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [otpSent]);

    useEffect(() => {
        let timer = null;
        if (resendLockTimeLeft > 0) {
            timer = setInterval(() => {
                setResendLockTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (isLocked && resendLockTimeLeft <= 0) {
            setIsLocked(false);
            setResendCount(0);
            localStorage.removeItem("setup_mfa_resend");
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [resendLockTimeLeft, isLocked]);

    const fileInputRef = useRef(null);
    const importInputRef = useRef(null);

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (isOpen && user) {
            setActiveTab("profile");
            setUsername(user.username || "");
            setFullName(user.fullName || "");
            setEmail(user.email || "");
            setPassword("");
            setAvatarPreview(user.avatar || "");
            setOnlineVisibility(user.privacySettings?.onlineStatus || "everyone");
            setNameVisibility(user.privacySettings?.fullName || "everyone");
            setAvatarVisibility(user.privacySettings?.avatar || "everyone");
            setBio(user.bio || "");
            setAvatarFile(null);
            setToast(null);
            setIsSubscribing(false);
            setImageError(false);
            setProfileBlockError(null);
            setIs2faEnabled(user.is2faEnabled || false);
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

    useEffect(() => {
        let active = true;
        const localBlobUrls = [];

        if (isOpen) {
            const fetchCapturedMoments = async () => {
                setLoadingMoments(true);
                try {
                    const { data } = await axiosInstance.get("/moments/captured");
                    if (!active) return;

                    const decryptedMoments = await Promise.all(
                        data.map(async (mom) => {
                            if (!mom.isEncrypted) return mom;
                            try {
                                const keys = await getLocalE2EEKeys();
                                if (!keys || !keys.privateKey) return mom;

                                const encryptedKeysMap = mom.encryptedKeys instanceof Map
                                    ? Object.fromEntries(mom.encryptedKeys)
                                    : mom.encryptedKeys || {};

                                const decryptedPayloadStr = await decryptForMultipleRecipients(
                                    mom.encryptedPayload,
                                    encryptedKeysMap,
                                    mom.iv,
                                    keys.privateKey,
                                    user?._id
                                );

                                const payload = JSON.parse(decryptedPayloadStr);
                                let decryptedMediaUrl = mom.mediaUrl;

                                if (payload.mediaUrl && payload.fileKey && payload.fileIv) {
                                    const res = await fetch(payload.mediaUrl);
                                    if (res.ok) {
                                        const encryptedBlob = await res.blob();
                                        const decryptedBlob = await decryptFileAES(
                                            encryptedBlob,
                                            payload.fileKey,
                                            payload.fileIv,
                                            payload.type === "video" ? "video/mp4" : "image/jpeg"
                                        );
                                        const objectUrl = URL.createObjectURL(decryptedBlob);
                                        localBlobUrls.push(objectUrl);
                                        decryptedMediaUrl = objectUrl;
                                    }
                                } else if (payload.mediaUrl) {
                                    decryptedMediaUrl = payload.mediaUrl;
                                }

                                return {
                                    ...mom,
                                    ...payload,
                                    mediaUrl: decryptedMediaUrl
                                };
                            } catch (decErr) {
                                console.error("[ProfileModal] Captured moment decryption failed:", decErr);
                                return {
                                    ...mom,
                                    content: "[Decryption failed]",
                                    caption: "",
                                    mediaUrl: ""
                                };
                            }
                        })
                    );

                    if (active) {
                        setCapturedMoments(decryptedMoments);
                    }
                } catch (err) {
                    console.error("Failed to fetch captured moments:", err);
                } finally {
                    if (active) {
                        setLoadingMoments(false);
                    }
                }
            };
            fetchCapturedMoments();
        }

        return () => {
            active = false;
            localBlobUrls.forEach((url) => {
                if (url.startsWith("blob:")) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [isOpen, user?._id]);

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
            if (file.size > 10 * 1024 * 1024) {
                showToast("Image too large. Max 10MB.");
                return;
            }
            const url = URL.createObjectURL(file);
            setCropImage(url);
            e.target.value = "";
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
        if (bio !== user.bio) formData.append("bio", bio);
        if (email !== user.email) formData.append("email", email);
        if (password) formData.append("password", password);
        if (avatarFile) {
            formData.append("avatar", avatarFile);
        } else if (!avatarPreview) {
            formData.append("clearAvatar", "true");
        }
        formData.append("is2faEnabled", is2faEnabled ? "true" : "false");
        formData.append("mfaPreference", "email");

        const privacySettings = { 
            onlineStatus: onlineVisibility, 
            fullName: nameVisibility,
            avatar: avatarVisibility
        };
        formData.append("privacySettings", JSON.stringify(privacySettings));
        const res = await updateProfile(formData);
        if (res.success) {
            showToast("Profile updated successfully.");
            setTimeout(() => {
                onSave?.();
                onClose();
                window.location.reload();
            }, 1000);
        } else {
            showToast(res.message);
        }
    };

    const handleSendVerificationCode = async () => {
        if (!email.trim()) {
            showToast("Please enter a valid email address.");
            return;
        }
        if (resendLockTimeLeft > 0 || isLocked) return;

        let newCount = resendCount + 1;
        let lockUntil = null;
        let newCooldown = 30; // 30 seconds
        
        if (newCount >= 3) {
            lockUntil = Date.now() + 60 * 60 * 1000; // 1 hour
            newCooldown = 3600;
            setIsLocked(true);
        }
        
        setResendCount(newCount);
        setResendLockTimeLeft(newCooldown);
        localStorage.setItem("setup_mfa_resend", JSON.stringify({
            count: newCount,
            lastResend: Date.now(),
            lockUntil
        }));

        setIsE2EELoading(true);
        try {
            const { data } = await axiosInstance.post("/auth/2fa/setup/request");
            showToast(data.message || "Verification code sent to your email.");
            setOtpSent(true);
            setExpiryTimeLeft(300); // 5 minutes countdown
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
            const { data } = await axiosInstance.post("/auth/2fa/setup/verify", {
                otpCode: otpCode.trim()
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

    const getNotificationStatus = () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return { className: "profile-badge-red", text: "Push Unsupported" };
        }
        if (window.Notification.permission === "denied") {
            return { className: "profile-badge-red", text: "Push Blocked" };
        }
        if (isSubscribedInBrowser) {
            return { className: "profile-badge-green", text: "Push Alerts On" };
        }
        return { className: "profile-badge-grey", text: "Push Alerts Off" };
    };
    const notifStatus = getNotificationStatus();

    const hasChanges = useMemo(() => {
        if (!user) return false;
        const norm = (val) => val === undefined || val === null ? "" : String(val).trim();
        const usernameChanged = norm(username) !== norm(user.username);
        const fullNameChanged = norm(fullName) !== norm(user.fullName);
        const bioChanged = norm(bio) !== norm(user.bio);
        const emailChanged = norm(email) !== norm(user.email);
        const passwordChanged = password.length > 0;
        const avatarChanged = avatarFile !== null || norm(avatarPreview) !== norm(user.avatar);
        const onlineVisibilityChanged = norm(onlineVisibility) !== norm(user.privacySettings?.onlineStatus || "everyone");
        const nameVisibilityChanged = norm(nameVisibility) !== norm(user.privacySettings?.fullName || "everyone");
        const avatarVisibilityChanged = norm(avatarVisibility) !== norm(user.privacySettings?.avatar || "everyone");
        const twoFaChanged = (is2faEnabled !== (user.is2faEnabled || false));

        return usernameChanged || fullNameChanged || bioChanged || emailChanged || passwordChanged || avatarChanged || onlineVisibilityChanged || nameVisibilityChanged || avatarVisibilityChanged || twoFaChanged;
    }, [username, fullName, bio, email, password, avatarFile, avatarPreview, onlineVisibility, nameVisibility, avatarVisibility, is2faEnabled, user]);

    return createPortal(
        <>
        <div className="modal-overlay moments-aura-overlay" style={{ zIndex: 10000 }}>
            {toast && <div className="zen-toast zen-toast-info" style={{ pointerEvents: 'none' }}>{toast}</div>}
            {isSubscribing && <LoadingOverlay message="Subscribing..." subMessage="Setting up your secure connection" />}
            {isE2EELoading && <LoadingOverlay message="Generating key..." subMessage="Performing zero-knowledge cryptographic operations" />}
            <div className="moments-aura-content profile-modal" onClick={(e) => e.stopPropagation()} style={{ width: "440px", maxWidth: "95%", padding: 0 }}>
                <div className="moments-aura-header">
                    <h2 className="moments-aura-title">Profile & Settings</h2>
                    <button className="aura-close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div style={{ padding: '12px 24px 24px' }}>
                    <div className="profile-tabs-container">
                        <button 
                            type="button"
                            className={`profile-tab-button ${activeTab === "profile" ? "active" : ""}`}
                            onClick={() => setActiveTab("profile")}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Profile
                        </button>
                        <button 
                            type="button"
                            className={`profile-tab-button ${activeTab === "settings" ? "active" : ""}`}
                            onClick={() => setActiveTab("settings")}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.5 1z" />
                            </svg>
                            Settings
                        </button>
                    </div>

                    {activeTab === "profile" && (
                        <div className="profile-view-layout">
                            <div className="profile-view-avatar-wrap">
                                <div className="profile-view-avatar">
                                    {(avatarPreview && !imageError) ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            onError={() => setImageError(true)}
                                        />
                                    ) : (
                                        <span>{getInitials(username || user?.username || "??")}</span>
                                    )}
                                </div>
                            </div>

                            <div className="profile-view-details">
                                <h3 className="profile-view-name">{fullName || username || user?.username}</h3>
                                <p className="profile-view-username">@{username || user?.username}</p>
                                
                                <div className="profile-view-bio-box">
                                    {bio.trim() ? bio : "No bio written yet..."}
                                </div>

                                <div className="profile-view-email-box">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                    <span>{email || user?.email}</span>
                                </div>

                                <div className="profile-status-badges">
                                    <div className={`profile-badge ${notifStatus.className}`}>
                                        <span className="profile-badge-indicator" />
                                        <span>{notifStatus.text}</span>
                                    </div>

                                    <div className={`profile-badge ${is2faEnabled ? "profile-badge-green" : "profile-badge-grey"}`}>
                                        <span className="profile-badge-indicator" />
                                        <span>{is2faEnabled ? "2FA Protected" : "2FA Disabled"}</span>
                                    </div>

                                    <div className={`profile-badge ${isLowBandwidth ? "profile-badge-amber" : "profile-badge-grey"}`}>
                                        <span className="profile-badge-indicator" />
                                        <span>{isLowBandwidth ? "SmartPayload Active" : "SmartPayload Off"}</span>
                                    </div>

                                    <div className={`profile-badge ${soundEnabled ? "profile-badge-green" : "profile-badge-grey"}`}>
                                        <span className="profile-badge-indicator" />
                                        <span>{soundEnabled ? "Sounds On" : "Sounds Muted"}</span>
                                    </div>
                                </div>

                                <div className="captured-moments-section" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px", marginTop: "20px", textAlign: "left" }}>
                                    <h4 style={{ margin: "0 0 12px 0", color: "#cbd5e1", fontSize: "0.85rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                                        </svg>
                                        Captured Moments
                                    </h4>
                                    
                                    {loadingMoments ? (
                                        <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
                                            <div className="spinner" style={{ width: "20px", height: "20px", border: "2px solid rgba(61, 165, 217, 0.2)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                        </div>
                                    ) : capturedMoments.length === 0 ? (
                                        <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: "0.78rem", background: "rgba(255,255,255,0.01)", borderRadius: "10px", border: "1px dashed var(--color-border, rgba(255,255,255,0.08))" }}>
                                            No captured moments yet. Toggle "Captured Moment" when sharing to save it here!
                                        </div>
                                    ) : (
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxHeight: "200px", overflowY: "auto", paddingRight: "4px" }} className="filter-scroll-strip">
                                            {capturedMoments.map((mom) => {
                                                const filterStyles = {
                                                    none: {},
                                                    warm: { filter: "sepia(0.3) saturate(1.2) contrast(1.1)" },
                                                    cold: { filter: "hue-rotate(180deg) saturate(1.1) contrast(1.05)" },
                                                    vivid: { filter: "saturate(1.6) contrast(1.15)" },
                                                    fade: { filter: "brightness(1.1) contrast(0.95) saturate(0.9)" },
                                                    bw: { filter: "grayscale(1) contrast(1.2)" }
                                                };

                                                return (
                                                    <div 
                                                        key={mom._id} 
                                                        onClick={() => setViewerMoment(mom)}
                                                        style={{ 
                                                            position: "relative", 
                                                            height: "90px", 
                                                            borderRadius: "10px", 
                                                            overflow: "hidden", 
                                                            border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
                                                            background: "linear-gradient(135deg, rgba(61,165,217,0.06) 0%, rgba(168,85,247,0.06) 100%)",
                                                            transition: "transform 0.2s, box-shadow 0.2s",
                                                            cursor: "pointer"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.transform = "translateY(-2px)";
                                                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.transform = "translateY(0)";
                                                            e.currentTarget.style.boxShadow = "none";
                                                        }}
                                                    >
                                                        <div style={{ position: "absolute", top: "6px", left: "6px", background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "2px 6px", fontSize: "0.58rem", color: "#e2e8f0", zIndex: 5, pointerEvents: "none" }}>
                                                            {new Date(mom.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                                                        </div>
                                                        {mom.type === "image" ? (
                                                            <>
                                                                <img 
                                                                    src={mom.mediaUrl} 
                                                                    alt="" 
                                                                    style={{ 
                                                                        width: "100%", 
                                                                        height: "100%", 
                                                                        objectFit: "cover", 
                                                                        ...filterStyles[mom.filter || "none"] 
                                                                    }} 
                                                                />
                                                                {mom.caption && (
                                                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", padding: "4px 8px", fontSize: "0.65rem", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                        {mom.caption}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div style={{ padding: "10px", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", boxSizing: "border-box" }}>
                                                                <div style={{ fontSize: "0.72rem", color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", lineClamp: 3, wordBreak: "break-word", lineHeight: "1.3" }}>
                                                                    {mom.content}
                                                                </div>
                                                                {mom.music && (
                                                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.6rem", color: "var(--color-primary)", width: "100%" }}>
                                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{mom.music.title}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Delete Button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setMomentToDelete(mom);
                                                            }}
                                                            style={{
                                                                position: "absolute",
                                                                top: "6px",
                                                                right: "6px",
                                                                background: "rgba(15, 23, 42, 0.75)",
                                                                border: "1px solid rgba(255,255,255,0.1)",
                                                                borderRadius: "50%",
                                                                width: "20px",
                                                                height: "20px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                color: "#ef4444",
                                                                cursor: "pointer",
                                                                zIndex: 10,
                                                                padding: 0
                                                            }}
                                                            title="Delete captured moment"
                                                        >
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "settings" && (
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
                        <label>Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="A little bit about yourself... (max 87 characters)"
                            maxLength={87}
                            style={{ 
                                width: '100%', 
                                padding: '10px 12px', 
                                background: 'rgba(0, 0, 0, 0.2)', 
                                border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))', 
                                borderRadius: '8px',
                                color: 'white',
                                minHeight: '60px',
                                resize: 'none',
                                fontSize: '0.9rem'
                            }}
                        />
                        <span style={{ fontSize: "0.75rem", color: bio.length === 87 ? "#ef4444" : "#64748b", textAlign: "right", display: "block", marginTop: "4px" }}>
                            {bio.length}/87
                        </span>
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
                                <CustomSelect
                                    value={onlineVisibility}
                                    onChange={setOnlineVisibility}
                                    options={VISIBILITY_OPTIONS}
                                    isMobile={isMobile}
                                />
                            </div>
                            <div className="form-group">
                                <label>Full Name</label>
                                <CustomSelect
                                    value={nameVisibility}
                                    onChange={setNameVisibility}
                                    options={VISIBILITY_OPTIONS}
                                    isMobile={isMobile}
                                />
                            </div>
                            <div className="form-group">
                                <label>Avatar Visibility</label>
                                <CustomSelect
                                    value={avatarVisibility}
                                    onChange={setAvatarVisibility}
                                    options={VISIBILITY_OPTIONS}
                                    isMobile={isMobile}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="profile-settings-row" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "var(--color-overlay, rgba(255, 255, 255, 0.03))", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <span style={{ fontWeight: "600", fontSize: "0.85rem", display: "block" }}>
                                    SmartPayload-OPtimization (#SP-OP)
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginTop: "4px", lineHeight: "1.3" }}>
                                    {isLowBandwidth 
                                        ? "Currently active to prevent network congestion by delaying media auto-downloads and throttling typing sockets." 
                                        : "Safeguards bandwidth automatically on 2G/3G connections and slow round-trip response states."
                                    }
                                </span>
                            </div>
                            <span style={{
                                fontSize: '0.7rem',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: isLowBandwidth ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                color: isLowBandwidth ? '#eab308' : '#64748b',
                                border: isLowBandwidth ? '1px solid rgba(234, 179, 8, 0.2)' : '1px solid var(--color-border, rgba(255, 255, 255, 0.08))',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {isLowBandwidth ? "Active" : "Off"}
                            </span>
                        </div>
                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "var(--color-overlay, rgba(255, 255, 255, 0.03))", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem" }}>Two-Factor Authentication (2FA)</span>
                                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Secure your account using Email OTP</span>
                            </div>

                            {is2faEnabled ? (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)", padding: "10px 14px", borderRadius: "8px", marginTop: "4px" }}>
                                    <div>
                                        <div style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                                            2FA is Active
                                        </div>
                                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>
                                            Code will be sent to email: {user?.email || ""}
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
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", paddingTop: "10px" }}>
                                    {!otpSent ? (
                                        <>
                                            <span style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: "1.4" }}>
                                                Two-factor authentication adds an extra layer of security. When enabled, you will be required to enter a 6-digit OTP code sent to your registered email address (<strong style={{ color: "var(--color-primary)" }}>{email}</strong>) during sign in.
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleSendVerificationCode}
                                                disabled={!email.trim()}
                                                style={{ 
                                                    background: !email.trim() ? "rgba(255, 255, 255, 0.05)" : "rgba(61, 165, 217, 0.15)", 
                                                    border: !email.trim() ? "1px solid var(--color-border, rgba(255, 255, 255, 0.08))" : "1px solid rgba(61, 165, 217, 0.3)", 
                                                    color: !email.trim() ? "#64748b" : "var(--color-primary)", 
                                                    padding: "8px 16px", 
                                                    borderRadius: "8px", 
                                                    fontSize: "0.8rem", 
                                                    fontWeight: "600", 
                                                    cursor: !email.trim() ? "not-allowed" : "pointer", 
                                                    width: "100%", 
                                                    marginTop: "4px" 
                                                }}
                                            >
                                                Enable 2FA
                                            </button>
                                        </>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "var(--color-overlay, rgba(255, 255, 255, 0.02))", padding: "12px", borderRadius: "8px", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <label style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: "600" }}>Enter 6-Digit Code</label>
                                                <span style={{ fontSize: "0.75rem", color: expiryTimeLeft > 0 ? "#94a3b8" : "#ef4444", fontWeight: "700" }}>
                                                    {expiryTimeLeft > 0 ? (
                                                        `Expires in: ${Math.floor(expiryTimeLeft / 60)}:${String(expiryTimeLeft % 60).padStart(2, '0')}`
                                                    ) : (
                                                        "Code Expired"
                                                    )}
                                                </span>
                                            </div>
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
                                                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                                    borderRadius: "8px",
                                                    padding: "10px 12px",
                                                    fontSize: "1.1rem",
                                                    color: "var(--color-text, #fff)",
                                                    letterSpacing: "8px",
                                                    textAlign: "center",
                                                    fontFamily: "monospace",
                                                    boxSizing: "border-box"
                                                }}
                                            />
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                                                <button
                                                    type="button"
                                                    onClick={handleSendVerificationCode}
                                                    disabled={resendLockTimeLeft > 0 || isLocked}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        color: (resendLockTimeLeft > 0 || isLocked) ? "#64748b" : "var(--color-primary)",
                                                        cursor: (resendLockTimeLeft > 0 || isLocked) ? "not-allowed" : "pointer",
                                                        fontSize: "0.75rem",
                                                        textDecoration: "underline",
                                                        fontWeight: "600"
                                                    }}
                                                >
                                                    {isLocked 
                                                        ? `Too many attempts. Try again in ${Math.floor(resendLockTimeLeft / 60)}m ${resendLockTimeLeft % 60}s`
                                                        : resendLockTimeLeft > 0 
                                                            ? `Resend Code in ${resendLockTimeLeft}s` 
                                                            : "Resend Code"
                                                    }
                                                </button>
                                            </div>
                                            <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center", marginTop: "8px" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOtpSent(false);
                                                        setOtpCode("");
                                                    }}
                                                    style={{ 
                                                        flex: 1, 
                                                        maxWidth: "150px", 
                                                        background: "var(--color-overlay, rgba(255, 255, 255, 0.06))", 
                                                        border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", 
                                                        color: "var(--color-text, #fff)", 
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
                                                    disabled={otpCode.length < 6 || isE2EELoading || expiryTimeLeft === 0}
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
                                                        opacity: (otpCode.length < 6 || isE2EELoading || expiryTimeLeft === 0) ? 0.5 : 1 
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

                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "var(--color-border, rgba(255, 255, 255, 0.08))", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "var(--color-overlay, rgba(255, 255, 255, 0.03))", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", borderRadius: "12px" }}>
                            <span style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Push Notifications</span>
                            {isSubscribedInBrowser ? (
                                <div style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: "500" }}>Subscribed in this browser</div>
                            ) : (
                                <button type="button" className="profile-subscribe-btn" onClick={handleSubscribe} style={{ width: "100%", background: "#3b82f6", color: "white", border: "none", padding: "9px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer" }}>
                                    Enable Push Notifications
                                </button>
                            )}
                        </div>

                        <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "var(--color-border, rgba(255, 255, 255, 0.08))", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", borderRadius: "12px" }}>
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
                                            style={{ flex: 1, padding: "8px 36px 8px 10px", borderRadius: "8px", background: "rgba(0, 0, 0, 0.4)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", color: "white", fontSize: "0.78rem", width: "100%" }}
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
                                            style={{ flex: 1, padding: "8px 36px 8px 10px", borderRadius: "8px", background: "rgba(0, 0, 0, 0.4)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", color: "white", fontSize: "0.78rem", width: "100%" }}
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
                            <div className="profile-setting-item" style={{ padding: "0.9rem 1rem", background: "var(--color-border, rgba(255, 255, 255, 0.08))", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
                                                background: isConfirmingRotate ? "rgba(244, 63, 94, 0.15)" : "var(--color-border, rgba(255, 255, 255, 0.08))",
                                                border: isConfirmingRotate ? "1px solid rgba(244, 63, 94, 0.4)" : "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
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
                                    <div style={{ background: "var(--color-surface, rgba(15, 23, 42, 0.6))", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "12px", borderRadius: "8px", marginTop: "0.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
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
                                                    style={{ background: "var(--color-overlay, rgba(255, 255, 255, 0.06))", border: "none", color: "#94a3b8", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "600", cursor: "pointer" }}
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
                                background: "var(--color-border, rgba(255, 255, 255, 0.08))",
                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
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
                                background: "var(--color-overlay, rgba(255, 255, 255, 0.05))",
                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
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
                        {/* recaptcha container removed */}
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isLoading || !hasChanges} style={{ width: "100%", marginTop: "1rem", padding: "12px", opacity: (!hasChanges || isLoading) ? 0.6 : 1, cursor: (!hasChanges || isLoading) ? "not-allowed" : "pointer" }}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </button>
                </form>
                )}
                </div>
            </div>
        </div>
        {momentToDelete && (
            isMobile ? (
                <div className="mobile-bottom-sheet-overlay" style={{ zIndex: 200000 }} onClick={() => setMomentToDelete(null)}>
                    <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: "20px 0 32px" }}>
                        <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#f8fafc", marginBottom: "8px", textAlign: "center", padding: "0 20px" }}>Delete Captured Moment</h3>
                        <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "24px", lineHeight: "1.5", textAlign: "center", padding: "0 20px" }}>Are you sure you want to delete this captured moment? This action is permanent and cannot be undone.</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", padding: "0 20px", boxSizing: "border-box" }}>
                            <button
                                className="btn"
                                onClick={async () => {
                                    const momId = momentToDelete._id;
                                    setMomentToDelete(null);
                                    try {
                                        await axiosInstance.delete(`/moments/${momId}`);
                                        setCapturedMoments(prev => prev.filter(m => m._id !== momId));
                                    } catch (err) {
                                        console.error("Failed to delete captured moment:", err);
                                    }
                                }}
                                style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "#ef4444", border: "none", color: "var(--color-text, #fff)", cursor: "pointer", fontWeight: "600", fontSize: "0.95rem" }}
                            >
                                Delete Moment
                            </button>
                            <button
                                className="btn"
                                onClick={() => setMomentToDelete(null)}
                                style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontSize: "0.95rem" }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="modal-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.4)", zIndex: 200000 }} onClick={() => setMomentToDelete(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "380px", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", background: "var(--color-surface, rgba(15, 23, 42, 0.9))", backdropFilter: "blur(20px)", padding: "24px", borderRadius: "16px", textAlign: "center" }}>
                        <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#f8fafc", marginBottom: "12px" }}>Delete Captured Moment</h3>
                        <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "24px", lineHeight: "1.5" }}>Are you sure you want to delete this captured moment? This action is permanent and cannot be undone.</p>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button
                                className="btn"
                                onClick={() => setMomentToDelete(null)}
                                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", background: "transparent", color: "#cbd5e1", cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn"
                                onClick={async () => {
                                    const momId = momentToDelete._id;
                                    setMomentToDelete(null);
                                    try {
                                        await axiosInstance.delete(`/moments/${momId}`);
                                        setCapturedMoments(prev => prev.filter(m => m._id !== momId));
                                    } catch (err) {
                                        console.error("Failed to delete captured moment:", err);
                                    }
                                }}
                                style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#ef4444", border: "none", color: "var(--color-text, #fff)", cursor: "pointer", fontWeight: "600" }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )
        )}
        {cropImage && (
            <ImageCropperModal
                src={cropImage}
                onClose={() => setCropImage(null)}
                onCrop={(croppedBlob) => {
                    setAvatarFile(croppedBlob);
                    const url = URL.createObjectURL(croppedBlob);
                    setAvatarPreview(url);
                    setImageError(false);
                    setCropImage(null);
                }}
            />
        )}
        {viewerMoment && (
            <MomentViewer 
                moments={[viewerMoment]} 
                isOpen={!!viewerMoment} 
                onClose={() => setViewerMoment(null)} 
            />
        )}
        </>,
        document.body
    );
};

export default ProfileModal;
