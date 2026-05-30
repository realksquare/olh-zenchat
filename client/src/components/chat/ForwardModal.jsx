import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';

const ForwardModal = ({ onClose, onForward }) => {
    const { chats } = useChatStore();
    const user = useAuthStore((s) => s.user);
    const [selectedChats, setSelectedChats] = useState([]);

    // Filter out chats where the current user is talking to themselves
    const forwardableChats = chats.filter(chat => {
        if (chat.isGroup) return true;
        const otherId = chat.participants?.find(p => {
            const pid = p?._id?.toString() || p?.toString();
            return pid && pid !== user?._id?.toString();
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

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000000 }}>
            <div className="modal-content bottom-sheet" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', padding: 0 }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#e2e8f0' }}>Forward to...</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>Select up to 3 chats</p>
                </div>
                <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '10px' }}>
                    {forwardableChats.map(chat => {
                        const isSelected = selectedChats.includes(chat._id);
                        const otherParticipant = chat.isGroup ? null : chat.participants?.find(p => {
                            const pid = p?._id?.toString() || p?.toString();
                            return pid && pid !== user?._id?.toString();
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
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
            </div>
        </div>,
        document.body
    );
};

export default ForwardModal;
