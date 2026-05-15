import { useState, memo } from "react";
import { createPortal } from "react-dom";

const InviteModal = ({ isOpen, onClose, username }) => {
    const [copied, setCopied] = useState(false);
    const inviteLink = `${window.location.origin}/register?ref=${username}`;
    const inviteMessage = `Hey! I've been using ZenChat and it's awesome. Sign up using my link to connect with me instantly! 🎉\n\nJoin here: ${inviteLink}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareSocial = (platform) => {
        let url = "";
        const encodedMsg = encodeURIComponent(inviteMessage);
        const encodedUrl = encodeURIComponent(inviteLink);

        switch (platform) {
            case "whatsapp":
                url = `https://wa.me/?text=${encodedMsg}`;
                break;
            case "linkedin":
                url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
                break;
            case "email":
                url = `mailto:?subject=Join me on ZenChat!&body=${encodedMsg}`;
                break;
            default:
                break;
        }

        if (url) window.open(url, "_blank");
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="modal-content invite-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", width: "90%" }}>
                <div className="modal-header">
                    <h2>Invite People</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="invite-body" style={{ padding: "20px 0" }}>
                    <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "20px" }}>
                        Share your unique referral link to grow your network and unlock exclusive rewards!
                    </p>

                    <div className="invite-link-box" style={{ 
                        background: "rgba(255,255,255,0.05)", 
                        padding: "12px", 
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        marginBottom: "24px"
                    }}>
                        <input 
                            type="text" 
                            readOnly 
                            value={inviteLink} 
                            style={{ 
                                background: "transparent", 
                                border: "none", 
                                color: "#fff", 
                                flex: 1, 
                                fontSize: "0.85rem",
                                outline: "none"
                            }} 
                        />
                        <button 
                            onClick={handleCopy}
                            style={{ 
                                background: copied ? "#22c55e" : "#3b82f6",
                                color: "#fff",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>

                    <div className="social-grid" style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(2, 1fr)", 
                        gap: "12px" 
                    }}>
                        <button className="social-share-btn" onClick={() => shareSocial("whatsapp")} style={socialBtnStyle}>
                            <WhatsAppIcon />
                            WhatsApp
                        </button>
                        <button className="social-share-btn" onClick={() => handleCopy()} style={socialBtnStyle}>
                            <InstagramIcon />
                            Instagram
                        </button>
                        <button className="social-share-btn" onClick={() => shareSocial("linkedin")} style={socialBtnStyle}>
                            <LinkedInIcon />
                            LinkedIn
                        </button>
                        <button className="social-share-btn" onClick={() => shareSocial("email")} style={socialBtnStyle}>
                            <EmailIcon />
                            Email
                        </button>
                    </div>
                </div>

                <div className="modal-footer" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px", textAlign: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Referral bonuses are automatically credited upon sign-up.
                    </span>
                </div>
            </div>
            <style>{`
                .social-share-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 12px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 12px;
                    color: #fff;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .social-share-btn:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.2);
                    transform: translateY(-2px);
                }
            `}</style>
        </div>,
        document.body
    );
};

const socialBtnStyle = {
    // Shared via CSS above
};

const WhatsAppIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-10.8 8.38 8.38 0 0 1 3.8.9L21 4.5l-1.4 5.9Z"></path>
    </svg>
);

const InstagramIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
);

const LinkedInIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0077B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
        <rect x="2" y="9" width="4" height="12"></rect>
        <circle cx="4" cy="4" r="2"></circle>
    </svg>
);

const EmailIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z"></path>
        <path d="M22 2 11 13"></path>
    </svg>
);

export default memo(InviteModal);
