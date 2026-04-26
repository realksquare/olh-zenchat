import { memo } from "react";

const FAQModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const faqContent = [
        {
            q: "What is ZenChat?",
            a: "A minimalist, premium real-time chat application built for speed and visual excellence. Developed by OLH DevTeam."
        },
        {
            q: "Who is behind OLH DevTeam?",
            a: "OLH (Online Learning Hub) DevTeam is led by Krish, a pre-final year B.E. ECE student at Vel Tech Multi Tech, Avadi, Chennai. Driven by a passion to build robust, minimalist solutions that contribute to society."
        },
        {
            q: "What are other notable works of OLH DevTeam?",
            a: "These include CertiSure (Certificate Authentication System - https://certisure-frontend.vercel.app) and MediSure (Medical Records Authentication System - https://medisure-certisure.vercel.app)."
        },
        {
            q: "What are the standout features of ZenChat?",
            a: "Secure real-time messaging, media sharing (images/videos) with upload progress, view-once media for privacy, message threading (replies), and pinning important chats. We prioritize reliability even on 2G / unstable networks with specialized data usage conservation strategies."
        },
        {
            q: "How does ZenChat ensure reliability on slow networks?",
            a: "We use a multi-layered approach: optimized image/video compression, small-chunk socket communication, and background sync through Service Workers. This ensures your messages reach their destination even when the signal is weak, providing a seamless experience on 2G/3G connections."
        },
        {
            q: "What is the tech stack?",
            a: "ZenChat is built using React (Frontend), Node.js & Express (Backend), MongoDB (Database), and Socket.io for instant real-time communication. Hosted on Vercel (frontend) and Render (backend)."
        },
        {
            q: "Who is the admin of OLH ZenChat?",
            a: "The master admin is @admin_krish. You can contact me for verification requests, account issues, or feedback."
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
