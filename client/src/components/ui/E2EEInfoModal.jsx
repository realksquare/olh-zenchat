import { memo } from "react";

const E2EEInfoModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const infoContent = [
        {
            q: "What is End-to-End Encryption in ZenChat?",
            a: "Active by default for everyone. ZenChat automatically secures all texts, photos, and files on your device before they even leave your screen. We use military-grade AES-GCM and RSA hybrid encryption, meaning only you and your recipient hold the keys to unlock them."
        },
        {
            q: "What is E2EE used for?",
            a: "Total shielding against data compromises. It keeps your personal conversations completely invisible to snooping ISPs, cloud database hackers, and even our own ZenChat developers. Your chats remain private, no matter what happens on the web."
        },
        {
            q: "How is it unique compared to other chat platforms?",
            a: "Pure Zero-Knowledge architecture. While typical apps decrypt and scan messages on their servers, ZenChat keeps private keys locked inside your local device. Your online key backups are cryptographically stretched in-browser using high-iteration PBKDF2 (NIST SP 800-132), accessible only by your password or offline recovery key."
        },
        {
            q: "How do I manage my offline recovery key?",
            a: "Your ultimate recovery safety net. Open Profile Settings by clicking your username inside the sidebar header to securely view or regenerate your offline backup key. Use this setting to instantly synchronize your encrypted chats when logging in on a new device."
        },
        {
            q: "How do media files and documents fall under the E2EE policy?",
            a: "Double-locked media files. ZenChat uploads media securely, but scrambles the file location links and metadata using your chat's local symmetric key before transmission. Our server never sees where your photos, videos, or documents are stored - only you can render them."
        }
    ];

    return (
        <div className="admin-modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
            <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="admin-header">
                    <h2>End-to-End Encryption FAQ</h2>
                    <button className="admin-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="admin-body">
                    <div className="faq-list">
                        {infoContent.map((item, i) => (
                            <div key={i} className="faq-item" style={{ marginBottom: '20px' }}>
                                <h3 style={{ color: 'var(--color-primary)', fontSize: '0.95rem', marginBottom: '6px' }}>{item.q}</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5' }}>{item.a}</p>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                        Zero-Knowledge Security | ZenChat E2EE Protocol V1.0
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(E2EEInfoModal);
