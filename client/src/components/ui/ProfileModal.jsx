import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { requestNotificationPermission } from "../../utils/firebase";

const ProfileModal = ({ isOpen, onClose, onSave }) => {
    const { user, updateProfile, isLoading, soundEnabled, toggleSound } = useAuthStore();
    const { chats, messages } = useChatStore();

    const [username, setUsername] = useState(user?.username || "");
    const [fullName, setFullName] = useState(user?.fullName || "");
    const [email, setEmail] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
    const [onlineVisibility, setOnlineVisibility] = useState(user?.privacySettings?.onlineStatus || "everyone");
    const [nameVisibility, setNameVisibility] = useState(user?.privacySettings?.fullName || "everyone");
    const [error, setError] = useState("");

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && user) {
            setUsername(user.username || "");
            setFullName(user.fullName || "");
            setEmail(user.email || "");
            setPassword("");
            setAvatarPreview(user.avatar || "");
            setOnlineVisibility(user.privacySettings?.onlineStatus || "everyone");
            setNameVisibility(user.privacySettings?.fullName || "everyone");
            setAvatarFile(null);
            setError("");
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setAvatarPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        const formData = new FormData();
        if (username !== user.username) formData.append("username", username);
        if (fullName !== user.fullName) formData.append("fullName", fullName);
        if (email !== user.email) formData.append("email", email);
        if (password) formData.append("password", password);
        if (avatarFile) formData.append("avatar", avatarFile);
        const privacySettings = { onlineStatus: onlineVisibility, fullName: nameVisibility };
        formData.append("privacySettings", JSON.stringify(privacySettings));
        const res = await updateProfile(formData);
        if (res.success) {
            onSave?.();
            onClose();
        } else {
            setError(res.message);
        }
    };

    const handleExport = () => {
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
    };

    const handleSubscribe = async () => {
        const token = await requestNotificationPermission();
        if (token) {
            const formData = new FormData();
            formData.append("notificationsEnabled", "true");
            formData.append("fcmToken", token);
            const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
            formData.append("deviceType", isPWA ? "pwa" : "browser");
            await updateProfile(formData);
            window.location.reload();
        } else {
            setError("Failed to enable notifications. Permission denied or error.");
        }
    };

    const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : "??";
    const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    const currentDeviceType = isPWA ? "pwa" : "browser";
    const isSubscribedInBrowser = Notification.permission === "granted" && 
                                  user?.fcmTokens?.some(t => t.deviceType === currentDeviceType);

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
                <h2>Profile & Settings</h2>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit} className="profile-form">
                    <div className="profile-avatar-section">
                        <div
                            className="avatar avatar-lg profile-avatar-edit"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar preview" />
                            ) : (
                                <span>{getInitials(username)}</span>
                            )}
                            <div className="avatar-edit-overlay">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                    <circle cx="12" cy="13" r="4" />
                                </svg>
                            </div>
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
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
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" minLength={6} />
                    </div>

                    <div className="privacy-section" style={{ marginTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.25rem" }}>
                        <h3 style={{ fontSize: "0.85rem", marginBottom: "1rem", color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Privacy</h3>
                        <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
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
                        </div>
                    </div>

                    <div className="profile-settings-row" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
                    </div>

                    <div className="actions-section" style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                        <button type="button" className="btn btn-outline" onClick={handleExport} style={{ flex: 1, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <span>Export</span>
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => alert("Import coming soon!")} style={{ flex: 1, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <span>Import</span>
                        </button>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: "100%", marginTop: "1rem", padding: "12px" }}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default ProfileModal;
