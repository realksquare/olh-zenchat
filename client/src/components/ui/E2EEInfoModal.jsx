import { memo } from "react";

const E2EEInfoModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const infoContent = [
        {
            q: "What is End-to-End Encryption in ZenChat?",
            a: "ZenChat uses zero-knowledge End-to-End Encryption (E2EE) to protect your conversations. When you send a message, it is encrypted on your device using a secure symmetric AES-GCM session key. This key is then wrapped using your recipient's RSA-OAEP public key. Only the recipient's private key can decrypt the message."
        },
        {
            q: "What is E2EE used for?",
            a: "It shields your communications from any form of external access. Since messages are encrypted before they leave your device, nobody - including internet service providers, database attackers, or ZenChat system administrators - can read your chats."
        },
        {
            q: "How is it unique compared to other chat platforms?",
            a: "Standard messaging apps often encrypt messages in transit but decrypt them on their servers, giving administrators full access. ZenChat implements a pure zero-knowledge architecture. Your private keys never leave your local device. In addition, your cloud key backups are securely stretched using PBKDF2 cryptographic derivation with a unique salt, ensuring that they can only be unlocked with your account password or your offline recovery key."
        },
        {
            q: "How do I activate and set up End-to-End Encryption?",
            a: "You can activate E2EE by clicking on your avatar or username in the sidebar header to open your Profile Settings. Locate the End-to-End Encryption card, enter your account password to initialize your secure key pair, and copy your offline recovery key. If you are logging in from a new device, you can use the same card to synchronize and cache your private key."
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
