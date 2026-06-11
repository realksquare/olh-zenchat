import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';

const ForwardModal = ({ onClose, onForward }) => {
    const { chats } = useChatStore();
    const user = useAuthStore((s) => s.user);
    const [selectedChats, setSelectedChats] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const forwardableChats = chats.filter(chat => {
        if (chat.isGroup) return true;
        const currentUserId = user?._id?.toString();
        const otherId = chat.participants?.find(p => {
            const pid = p?._id?.toString() || p?.toString();
            return pid && currentUserId && pid !== currentUserId;
        });
        return !!otherId;
    });

    const toggleSelect = (chatId) => {
        setSelectedChats(prev => {
            if (prev.includes(chatId)) return prev.filter(id => id !== chatId);
            if (prev.length >= 3) return prev; // max 3
            return [...prev, chatId];
        });
    };

    const handleConfirm = () => {
        if (selectedChats.length === 0) return;
        onForward(selectedChats);
    };

    const renderChatList = () => (
        <div style={{ maxHeight: isMobile ? 'none' : '50vh', flex: isMobile ? 1 : 'none', overflowY: 'auto', padding: isMobile ? '0' : '10px' }}>
            {forwardableChats.map(chat => {
                const isSelected = selectedChats.includes(chat._id);
                const currentUserId = user?._id?.toString();
                const otherParticipant = chat.isGroup ? null : chat.participants?.find(p => {
                    const pid = p?._id?.toString() || p?.toString();
                    return pid && currentUserId && pid !== currentUserId;
                });
                return (
                    <div 
                        key={chat._id} 
                        onClick={() => toggleSelect(chat._id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
                            borderRadius: '8px', cursor: 'pointer',
                            background: isSelected ? 'rgba(61, 165, 217, 0.15)' : 'transparent',
                            transition: 'background 0.2s'
                        }}
                    >
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: chat.isGroup ? '#475569' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {chat.isGroup ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            ) : otherParticipant?.profilePic ? (
                                <img src={otherParticipant.profilePic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ color: '#fff', fontWeight: 600 }}>{chat.chatName?.charAt(0) || otherParticipant?.username?.charAt(0) || '?'}</span>
                            )}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ color: '#f1f5f9', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {chat.isGroup ? chat.chatName : otherParticipant?.username || 'Unknown'}
                            </div>
                        </div>
                        {isSelected && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        )}
                    </div>
                );
            })}
            {forwardableChats.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No chats to forward to.</div>}
        </div>
    );

    const renderFooter = () => (
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: isMobile ? '8px' : '0' }}>
            <button 
                onClick={onClose}
                style={{ padding: '10px 16px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, borderRadius: '8px' }}
            >
                Cancel
            </button>
            <button 
                onClick={handleConfirm}
                disabled={selectedChats.length === 0}
                style={{ padding: '10px 20px', background: 'var(--color-primary)', border: 'none', color: '#fff', cursor: selectedChats.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, borderRadius: '8px', opacity: selectedChats.length === 0 ? 0.5 : 1 }}
            >
                Forward
            </button>
        </div>
    );

    if (isMobile) {
        return createPortal(
            <div className="mobile-bottom-sheet-overlay" style={{ zIndex: 1000000 }}>
                <div className="mobile-bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '82vh', display: 'flex', flexDirection: 'column', gap: '0', padding: '16px 0 24px' }}>
                    <div className="mobile-bottom-sheet-header" style={{ position: 'relative', marginBottom: '14px', paddingBottom: '0', paddingLeft: '20px', paddingRight: '50px', display: 'flex', alignItems: 'center', minHeight: '28px' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>Forward to...</h3>
                        <button onClick={onClose} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }} aria-label="Close Forward">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="mobile-bottom-sheet-content" style={{ overflowY: 'auto', flex: 1, paddingLeft: '20px', paddingRight: '20px', gap: '8px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>Select up to 3 chats</p>
                        {renderChatList()}
                    </div>
                    {renderFooter()}
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="admin-modal-overlay" style={{ zIndex: 1000000 }}>
            <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="admin-header">
                    <h2>Forward to...</h2>
                    <button className="admin-close-btn" onClick={onClose} aria-label="Close modal">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className="admin-body" style={{ display: 'flex', flexDirection: 'column', padding: '20px', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Select up to 3 chats</p>
                    {renderChatList()}
                </div>
                {renderFooter()}
            </div>
        </div>,
        document.body
    );
};

export default ForwardModal;
