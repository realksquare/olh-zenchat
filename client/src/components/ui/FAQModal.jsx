import { memo } from "react";

const FAQModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const faqContent = [
        {
            q: "What is ZenChat?",
            a: "Minimalist, ultra-fast, and stunning. ZenChat is built from the ground up for lightning-speed delivery and visual excellence. Proudly crafted by the OLH DevTeam."
        },
        {
            q: "Who is behind OLH DevTeam?",
            a: "Driven by engineering passion. Led by Krish, an ECE student in Chennai, OLH DevTeam is dedicated to building robust, minimalist digital products that create real-world societal value."
        },
        {
            q: "What are other notable works of OLH DevTeam?",
            a: "Proven security solutions. OLH DevTeam is also behind CertiSure (secure digital certificate verification) and MediSure (tamper-proof medical records authentication)."
        },
        {
            q: "What are the standout features of ZenChat?",
            a: "Power-packed messaging utilities. Enjoy real-time threads, upload progress, view-once self-destructing media, and chat pinning. All optimized to run flawlessly on poor 2G/3G connections with adaptive packet layout strategies (IETF RFC 8999)."
        },
        {
            q: "How does ZenChat ensure reliability on slow networks?",
            a: "Unbreakable connection stability. We combine aggressive image compression, packet-chunked sockets, and service worker background sync. Your messages go through even with one bar of signal (W3C Service Worker & Google offline-first guidelines)."
        },
        {
            q: "What is the tech stack?",
            a: "Cutting-edge modern framework stack. Powered by React (frontend), Node.js/Express (backend), MongoDB (database), and real-time Socket.io. Scaled on premium cloud nodes for zero lag."
        },
        {
            q: "Who is the admin of OLH ZenChat?",
            a: "Direct admin support. Managed by @admin_krish. Get in touch for immediate verification requests, feedback, or custom integrations."
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
