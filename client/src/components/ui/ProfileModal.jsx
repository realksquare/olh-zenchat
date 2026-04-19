import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { requestNotificationPermission } from "../../utils/firebase";

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, updateProfile, isLoading } = useAuthStore();
    
    const [username, setUsername] = useState(user?.username || "");
    const [email, setEmail] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
    const [error, setError] = useState("");
    
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && user) {
            setUsername(user.username || "");
            setEmail(user.email || "");
            setPassword("");
            setAvatarPreview(user.avatar || "");
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
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        
        const formData = new FormData();
        if (username !== user.username) formData.append("username", username);
        if (email !== user.email) formData.append("email", email);
        if (password) formData.append("password", password);
        if (avatarFile) formData.append("avatar", avatarFile);
        
        if (Array.from(formData.keys()).length === 0) {
            onClose();
            return;
        }

        const res = await updateProfile(formData);
        if (res.success) {
            window.location.reload();
        } else {
            setError(res.message);
        }
    };

    const handleSubscribe = async () => {
        const token = await requestNotificationPermission();
        if (token) {
            const formData = new FormData();
            formData.append("notificationsEnabled", "true");
            formData.append("fcmToken", token);
            await updateProfile(formData);
            window.location.reload();
        } else {
            setError("Failed to enable notifications. Permission denied or error occurred.");
        }
    };

    const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : "??";

    // Only consider "Subscribed" if the browser has permission AND we have a token in the DB
    const isSubscribedInBrowser = Notification.permission === "granted" && user?.fcmToken;

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
                <h2>Edit Profile</h2>
                
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
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            style={{ display: "none" }} 
                            onChange={handleFileChange}
                        />
                    </div>

                    <div className="form-group">
                        <label>Username</label>
                        <input 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)}
                            minLength={3}
                            maxLength={20}
                            required 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Email</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>New Password (optional)</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={6}
                            placeholder="Leave blank to keep current" 
                        />
                    </div>

                    <div className="profile-setting-item" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                        <div className="profile-setting-info" style={{ marginBottom: '1rem' }}>
                            <span className="profile-setting-label" style={{ display: 'block', fontWeight: '600', marginBottom: '0.25rem' }}>Push Notifications</span>
                            <span className="profile-setting-desc" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Get notified of new messages when the app is closed</span>
                        </div>
                        {isSubscribedInBrowser ? (
                            <button
                                type="button"
                                className="profile-subscribed-btn"
                                disabled
                                style={{
                                    width: '100%',
                                    background: "rgba(16, 185, 129, 0.1)",
                                    color: "#10b981",
                                    border: "1px solid rgba(16, 185, 129, 0.2)",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    fontSize: "0.875rem",
                                    fontWeight: "600",
                                    cursor: "default",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px"
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Subscribed in this browser
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="profile-subscribe-btn"
                                onClick={handleSubscribe}
                                style={{
                                    width: '100%',
                                    background: "#3b82f6",
                                    color: "white",
                                    border: "none",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    fontSize: "0.875rem",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                Enable Notifications
                            </button>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%' }}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default ProfileModal;
