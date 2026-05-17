import { useState, useRef, memo, useEffect } from "react";
import { createPortal } from "react-dom";

const InviteModal = ({ isOpen, onClose, username }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);
    const [activeTab, setActiveTab] = useState("whatsapp");
    const [copied, setCopied] = useState(false);
    const tabsRef = useRef(null);

    const inviteLink = `${window.location.origin}/register?ref=${username}`;
    const inviteMessage = `Hey! You should check out ZenChat! It's the most reliable, privacy-focused chat app I've used.\n\n` +
        `• Ultra-low data usage\n` +
        `• No paywalls, no ads, no trackers\n` +
        `• Zero distractions, just pure focus\n` +
        `• Privacy-first architecture\n` +
        `• Lightweight and lightning-fast\n\n` +
        `Join me here: ${inviteLink}`;

    const handleAction = () => {
        const encodedMsg = encodeURIComponent(inviteMessage);
        const encodedUrl = encodeURIComponent(inviteLink);

        switch (activeTab) {
            case "whatsapp":
                window.open(`https://wa.me/?text=${encodedMsg}`, "_blank");
                break;
            case "linkedin":
                navigator.clipboard.writeText(inviteMessage);
                window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodedMsg}`, "_blank");
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
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

    const scrollTabs = (dir) => {
        if (tabsRef.current) {
            tabsRef.current.scrollBy({ left: dir === 'left' ? -100 : 100, behavior: 'smooth' });
        }
    };

    const tabs = [
        { id: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon />, instr: "Open WhatsApp to share directly with your contacts, groups, or as a Status update." },
        { id: "instagram", label: "Instagram", icon: <InstagramIcon />, instr: "Click 'Copy Link' to copy your invite. Then open Instagram to paste it into a DM or as a Story sticker." },
        { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon />, instr: "Message copied! Paste it into your professional post or send it as a direct message to your network." },
        { id: "email", label: "Email", icon: <EmailIcon />, instr: "Send a pre-formatted email invitation to your friends and colleagues." },
        { id: "copy", label: "Copy Link", icon: <CopyIcon />, instr: "Simply copy the full invitation text and link to your clipboard to paste anywhere." }
    ];

    if (!isOpen) return null;

    const currentTab = tabs.find(t => t.id === activeTab);

    return createPortal(
        <div className="modal-overlay moments-aura-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            {copied && <div className="aura-toast" style={{ zIndex: 10001, bottom: '20px' }}>📋 Invitation copied to clipboard!</div>}

            <div className="moments-aura-content invite-modal-v3" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px", width: "95%", padding: 0 }}>
                <div className="moments-aura-header">
                    <h2 className="moments-aura-title">Invite People</h2>
                    <button className="aura-close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div style={{ position: 'relative', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <button onClick={() => scrollTabs('left')} style={{ ...arrowStyle, left: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>

                    <div ref={tabsRef} className="invite-v2-tabs" style={{ display: 'flex', overflowX: 'auto', padding: '0 32px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '16px 20px',
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

                    <button onClick={() => scrollTabs('right')} style={{ ...arrowStyle, right: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>

                <div className="invite-v2-body" style={{ padding: '35px 24px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <div style={{ fontSize: '2.8rem', marginBottom: '18px', display: 'flex', justifyContent: 'center' }}>
                            {currentTab?.icon}
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem', fontWeight: 600, color: '#fff' }}>
                            {activeTab === "copy" ? "Copy Link" : `Share via ${currentTab?.label}`}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
                            {currentTab?.instr}
                        </p>
                    </div>

                    <button
                        onClick={handleAction}
                        style={{
                            width: '100%',
                            padding: '15px',
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '14px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 8px 20px rgba(59, 130, 246, 0.25)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.background = '#2563eb';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.background = '#3b82f6';
                        }}
                    >
                        {activeTab === "copy" || activeTab === "instagram" ? "Copy Link" : "Continue to " + currentTab?.label}
                    </button>
                </div>
            </div>
            <style>{`
                .invite-v2-tabs::-webkit-scrollbar { display: none; }
                .banner-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>,
        document.body
    );
};

const arrowStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '32px',
    background: '#0f172a',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
    transition: 'all 0.2s',
    opacity: 1,
    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
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
