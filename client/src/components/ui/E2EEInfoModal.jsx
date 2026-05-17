import { memo } from "react";

const E2EEInfoModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const infoContent = [
        {
            q: "What is End-to-End Encryption in ZenChat?",
            a: "In simple terms, E2EE means your messages are locked before they leave your device, and only your recipient can unlock them. We secure everything—text, photos, and files—using a secure key that is never shared with us, so nobody else can read them."
        },
        {
            q: "What is E2EE used for?",
            a: "It protects your conversations from any outside eyes. Because the encryption happens entirely on your phone or computer, not even internet providers, hackers, or our own database admins can see what you write or share."
        },
        {
            q: "How is it unique compared to other chat platforms?",
            a: "Unlike most apps that decrypt your messages on their servers to process them, ZenChat never sees your private keys. They live solely in your browser's secure memory. We also stretch your backup keys locally using standard PBKDF2 guidelines (NIST SP 800-132), so they remain fully zero-knowledge."
        },
        {
            q: "How do I manage my offline recovery key?",
            a: "You can view or regenerate your offline key by clicking your avatar in the sidebar to open Profile Settings. It acts as your ultimate safety net—keep it somewhere safe so you can decrypt and access your chat history if you ever switch devices or reset your password."
        },
        {
            q: "How do media files and documents fall under the E2EE policy?",
            a: "We upload your files securely, but we encrypt the storage links and metadata locally before sending them to our servers. Because the server only sees scrambled text instead of the actual file URL, your shared media remains completely private."
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
