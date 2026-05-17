import { memo, useEffect } from "react";

const FAQModal = ({ isOpen, onClose }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const faqContent = [
        {
            q: "What is ZenChat?",
            a: "A minimalist, lightning-fast chat app designed to look sleek and premium. Built by the OLH DevTeam to give you a clean, clutter-free messaging experience."
        },
        {
            q: "Who is behind OLH DevTeam?",
            a: "OLH DevTeam is led by Krish, an ECE engineering student based in Chennai. We are passionate about building robust, sleek, and highly practical software."
        },
        {
            q: "What are other notable works of OLH DevTeam?",
            a: "Other works include CertiSure (a digital certificate authentication system) and MediSure (a secure platform for medical records authentication)."
        },
        {
            q: "What are the standout features of ZenChat?",
            a: "You get instant messaging, threaded replies, view-once media, and chat pinning. Everything is optimized to work beautifully even on unstable networks."
        },
        {
            q: "How does ZenChat ensure reliability on slow networks?",
            a: "We use smart image compression, send websocket data in highly efficient small chunks, and use service workers to sync in the background. It means your messages reach their destination even if you only have one bar of cell service."
        },
        {
            q: "What is the tech stack?",
            a: "ZenChat is built with React on the frontend, Node.js and Express powering the backend, MongoDB for data storage, and Socket.io for the instant messaging. The entire setup is hosted on Vercel and Render for optimal performance."
        },
        {
            q: "Who is the admin of OLH ZenChat?",
            a: "The master admin is @admin_krish. Feel free to reach out directly if you have any questions, need account verification, or just want to share feedback!"
        }
    ];

    return (
        <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
            <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="admin-header">
                    <h2>ZenChat FAQ</h2>
                    <button className="admin-close-btn" onClick={onClose} aria-label="Close modal">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
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
