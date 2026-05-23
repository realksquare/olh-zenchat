import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const FAQModal = ({ isOpen, onClose }) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        // Scroll lock only on desktop to prevent mobile sticky scroll issues
        if (isOpen && !isMobile) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen, isMobile]);

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
            q: "What is SmartPayload-OPtimization (#SP-OP)?",
            a: "SP-OP is our proprietary technique that automatically safeguards performance under unstable network conditions. If 2G, 3G, or browser Data Saver mode is detected, SP-OP dynamically halts auto-download of media assets (rendering interactive preview cards instead) and throttles typing indicators down from high-frequency key-by-key socket streams to a single packet frame. This guarantees critical text messages deliver instantaneously without connection clogging."
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

    if (isMobile) {
        return createPortal(
            <div className="mobile-bottom-sheet-overlay" style={{ zIndex: 2000 }}>
                <div className="mobile-bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '82vh', display: 'flex', flexDirection: 'column', gap: '0', padding: '16px 20px 24px' }}>
                    <div className="mobile-bottom-sheet-handle" />
                    <div className="mobile-bottom-sheet-header" style={{ marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>ZenChat FAQ</h3>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }} aria-label="Close FAQ">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="mobile-bottom-sheet-content" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', gap: '16px' }}>
                        {faqContent.map((item, i) => (
                            <div key={i} className="faq-item" style={{ marginBottom: '16px' }}>
                                <h4 style={{ color: 'var(--color-primary)', fontSize: '0.92rem', fontWeight: 600, marginBottom: '6px', marginTop: 0 }}>{item.q}</h4>
                                <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: '1.5', margin: 0 }}>{item.a}</p>
                            </div>
                        ))}
                        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '0.78rem', color: '#64748b', textAlign: 'center' }}>
                            &copy; 2026 OLH ZenChat | v1.0b Pre-release
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="admin-modal-overlay" style={{ zIndex: 2000 }}>
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
                        &copy; 2026 OLH ZenChat | v1.0b Pre-release
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(FAQModal);
