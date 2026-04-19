import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { requestNotificationPermission } from "../../utils/firebase";

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, updateProfile, isLoading } = useAuthStore();
    
    const [username, setUsername] = useState(user?.username || "");
    const [email, setEmail] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled || false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
    const [error, setError] = useState("");
    
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && user) {
            setUsername(user.username || "");
            setEmail(user.email || "");
            setPassword("");
            setNotificationsEnabled(user.notificationsEnabled || false);
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

        // Always handle notification state so FCM token stays fresh
        formData.append("notificationsEnabled", notificationsEnabled);
        if (notificationsEnabled) {
            const token = await requestNotificationPermission();
            if (token) {
                formData.append("fcmToken", token);
            } else {
                setError("Failed to enable push notifications. Permission denied.");
                return;
            }
        } else {
            formData.append("fcmToken", ""); // clear token if disabled
        }

        if (avatarFile) formData.append("avatar", avatarFile);
        
        if (Array.from(formData.keys()).length === 0) {
            onClose();
            return;
        }

        const res = await updateProfile(formData);
        if (res.success) {
            // Close modal and refresh the whole app so all state is fresh
            window.location.reload();
        } else {
            setError(res.message);
        }
    };

    const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : "??";

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

                    <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', marginBottom: '1rem' }}>
                        <label style={{ fontSize: '14px', color: '#e2e8f0', cursor: 'pointer' }} onClick={() => setNotificationsEnabled(!notificationsEnabled)}>
                            Enable Push Notifications
                        </label>
                        <div 
                            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                            style={{
                                width: '40px',
                                height: '24px',
                                background: notificationsEnabled ? '#3da5d9' : '#334155',
                                borderRadius: '12px',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'background 0.3s ease'
                            }}
                        >
                            <div style={{
                                width: '18px',
                                height: '18px',
                                background: '#fff',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '3px',
                                left: notificationsEnabled ? '19px' : '3px',
                                transition: 'left 0.3s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default ProfileModal;
