import { useState, memo } from "react";
import { createPortal } from "react-dom";

const InviteModal = ({ isOpen, onClose, username }) => {
    const [activeTab, setActiveTab] = useState("whatsapp");
    const [copied, setCopied] = useState(false);
    
    const inviteLink = `${window.location.origin}/register?ref=${username}`;
    const inviteMessage = `Hey! You should check out ZenChat! 🚀 It's the most reliable, privacy-focused chat app I've used.\n\n` +
        `📉 Ultra-low data usage\n` +
        `💸 No paywalls, no ads, no trackers\n` +
        `🧘 Zero distractions, just pure focus\n` +
        `🔒 Privacy-first architecture\n` +
        `⚡️ Lightweight and lightning-fast\n\n` +
        `Join me here: ${inviteLink}`;

    const handleAction = () => {
        const encodedMsg = encodeURIComponent(inviteMessage);
        const encodedUrl = encodeURIComponent(inviteLink);

        switch (activeTab) {
            case "whatsapp":
                window.open(`https://wa.me/?text=${encodedMsg}`, "_blank");
                break;
            case "linkedin":
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, "_blank");
                break;
            case "email":
                window.open(`mailto:?subject=Join me on ZenChat!&body=${encodedMsg}`, "_blank");
                break;
            case "instagram":
            case "copy":
                navigator.clipboard.writeText(inviteMessage);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
                break;
            default:
                break;
        }
    };

    const tabs = [
        { id: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon />, instr: "Open WhatsApp to share directly with your contacts, groups, or as a Status update." },
        { id: "instagram", label: "Instagram", icon: <InstagramIcon />, instr: "Click 'Continue' to copy your invite. Then open Instagram to paste it into a DM or as a Story sticker." },
        { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon />, instr: "Share your referral link as a professional post or send it as a direct message to your network." },
        { id: "email", label: "Email", icon: <EmailIcon />, instr: "Send a pre-formatted email invitation to your friends and colleagues." },
        { id: "copy", label: "Copy Link", icon: <CopyIcon />, instr: "Simply copy the full invitation text and link to your clipboard to paste anywhere." }
    ];

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            {copied && <div className="aura-toast" style={{ zIndex: 10001, bottom: '20px' }}>📋 Invitation copied to clipboard!</div>}
            
            <div className="modal-content invite-modal-v2" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px", width: "95%", padding: 0, overflow: 'hidden' }}>
                <div className="invite-v2-header" style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Invite People</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <div className="invite-v2-tabs" style={{ display: 'flex', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: '0 10px' }}>
                    {tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '15px 20px',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                                color: activeTab === tab.id ? '#fff' : '#64748b',
                                fontSize: '0.85rem',
                                fontWeight: activeTab === tab.id ? '600' : '400',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="invite-v2-body" style={{ padding: '30px 20px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>
                            {tabs.find(t => t.id === activeTab)?.icon}
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>Share via {tabs.find(t => t.id === activeTab)?.label}</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '300px', margin: '0 auto' }}>
                            {tabs.find(t => t.id === activeTab)?.instr}
                        </p>
                    </div>

                    <button 
                        onClick={handleAction}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                            transition: 'transform 0.2s, background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        {activeTab === "copy" || activeTab === "instagram" ? "Copy Invitation" : "Continue to " + tabs.find(t => t.id === activeTab)?.label}
                    </button>
                </div>

                <div style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Unlock rewards with every new member
                    </span>
                </div>
            </div>
        </div>,
        document.body
    );
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

const CopyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

export default memo(InviteModal);

export default memo(InviteModal);
