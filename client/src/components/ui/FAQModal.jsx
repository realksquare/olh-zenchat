import { memo } from "react";

const FAQModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const faqContent = [
        {
            q: "What is ZenChat?",
            a: "A minimalist, premium real-time chat application built for speed and visual excellence. Developed by the OLH DevTeam."
        },
        {
            q: "What are the standout features?",
            a: "Secure real-time messaging, media sharing (images/videos) with upload progress, view-once media for privacy, message threading (replies), pinning important chats, and verified user badges."
        },
        {
            q: "What is the tech stack?",
            a: "ZenChat is built using React (Frontend), Node.js & Express (Backend), MongoDB (Database), and Socket.io for instant real-time communication."
        },
        {
            q: "Who is the admin?",
            a: "The master admin is admin_krish. You can contact him for verification requests, account issues, or feedback."
        },
        {
            q: "How does 'View Once' work?",
            a: "When you send a media file with View Once active, the recipient can only see it for a few seconds before it's permanently masked and deleted from their view."
        }
    ];

    return (
        <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
            <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="admin-header">
                    <h2>ZenChat FAQ</h2>
                    <button className="admin-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="admin-body">
                    <div className="faq-list">
                        {faqContent.map((item, i) => (
                            <div key={i} className="faq-item" style={{ marginBottom: '20px' }}>
                                <h3 style={{ color: 'var(--color-primary)', fontSize: '0.95rem', marginBottom: '6px' }}>{item.q}</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5' }}>{item.a}</p>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                        &copy; 2026 OLH ZenChat | V2.4 Stable
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(FAQModal);
