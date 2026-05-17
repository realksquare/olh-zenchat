import { memo } from "react";

const FAQModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const faqContent = [
        {
            q: "What is ZenChat?",
            a: "It is a minimalist, lightning-fast chat app designed to look gorgeous and feel premium. It was built by our team at OLH to give you a clean, clutter-free messaging experience."
        },
        {
            q: "Who is behind OLH DevTeam?",
            a: "We are led by Krish, an ECE engineering student based in Chennai. We are incredibly passionate about building robust, sleek, and highly practical software that makes a genuine difference in daily lives."
        },
        {
            q: "What are other notable works of OLH DevTeam?",
            a: "We have built several security-focused products, including CertiSure (a digital certificate authentication system) and MediSure (a secure platform for medical records authentication)."
        },
        {
            q: "What are the standout features of ZenChat?",
            a: "You get instant messaging, threaded replies to keep discussions organized, view-once media that self-destructs after opening, and chat pinning. Everything is optimized to work beautifully even on unstable networks (ref. IETF RFC 8999)."
        },
        {
            q: "How does ZenChat ensure reliability on slow networks?",
            a: "We use smart image compression, send websocket data in highly efficient small chunks, and use service workers to sync in the background. It means your messages reach their destination even if you only have one bar of cell service (ref. W3C & Google Web Dev guidelines)."
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
