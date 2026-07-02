import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ChatWindow from '../chat/ChatWindow';
import Sidebar from '../chat/Sidebar';
import { useChatStore } from '../../stores/chatStore';
import { useMomentStore } from '../../stores/momentStore';
import { useAuthStore } from '../../stores/authStore';

const QuickAvatarRing = ({ chat }) => {
    const user = useAuthStore(s => s.user);
    const setActiveChat = useChatStore(s => s.setActiveChat);
    const activeChat = useChatStore(s => s.activeChat);
    const unreadCount = useChatStore(s => s.unreadCounts[chat._id] || 0);
    const onlineUsers = useChatStore(s => s.onlineUsers);
    const isOffline = useChatStore(s => s.isOffline);
    const isLowBandwidth = useChatStore(s => s.isLowBandwidth);
    const peerLowBandwidth = useChatStore(s => s.peerLowBandwidth);

    const otherUser = chat.isGroup ? null : chat.participants.find(p => p?._id?.toString() !== user?._id?.toString());
    const otherUserId = otherUser?._id?.toString();

    if (!otherUser) return null;

    const isBlocked = chat.blockStatus?.iBlocked || chat.blockStatus?.theyBlocked;
    const isOnline = !isBlocked && !isOffline && !otherUser?.presenceHidden && (otherUser?.isOnline || (otherUserId && onlineUsers.has(otherUserId)));
    const isSPOp = isLowBandwidth || (isOnline && peerLowBandwidth[otherUserId] === true);
    const isActive = activeChat?._id === chat._id;

    return (
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div 
                className={`avatar avatar-sm ${isActive ? 'active-quick-avatar' : ''}`}
                style={{ 
                    cursor: 'pointer',
                    position: 'relative'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveChat(chat);
                }}
            >
                {otherUser.avatar ? (
                    <img src={otherUser.avatar} alt={otherUser.username} loading="lazy" />
                ) : (
                    <span>{otherUser.username?.slice(0, 2).toUpperCase()}</span>
                )}
                {unreadCount > 0 && (
                    <span className="quick-avatar-unread-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                {isOnline && (
                    <span className={`quick-avatar-online-dot ${isSPOp ? 'online-dot--amber' : ''}`} />
                )}
            </div>
            {isActive && <div className="quick-avatar-divider" />}
        </div>
    );
};

const BottomSheetLayout = () => {
    const [sheetHeight, setSheetHeight] = useState('collapsed'); // 'collapsed' | 'mid' | 'full'
    const [isDragging, setIsDragging] = useState(false);
    
    // Use raw px values for inline transform instead of relying purely on classes for smooth drag
    const [dragY, setDragY] = useState(null); 
    const dragStartY = useRef(null);
    const initialTranslateY = useRef(0);
    const sheetRef = useRef(null);
    const lastY = useRef(null);
    const lastTime = useRef(null);
    const velocityY = useRef(0);

    const chats = useChatStore(s => s.chats);
    const unreadCounts = useChatStore(s => s.unreadCounts);
    const activeChat = useChatStore(s => s.activeChat);

    const recentChats = useMemo(() => {
        return [...chats].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }, [chats]);

    const totalUnread = useMemo(() => {
        return Object.values(unreadCounts).reduce((acc, count) => acc + count, 0);
    }, [unreadCounts]);

    // Calculate fixed height bounds
    const getHeights = useCallback(() => {
        const vh = window.innerHeight;
        const sheetMax = vh * 0.92; // 92dvh
        return {
            full: 0,
            mid: sheetMax - (vh * 0.48), // 48dvh from bottom
            collapsed: sheetMax - 58, // 58px exposed
            sheetMax
        };
    }, []);

    const handleTouchStart = (e) => {
        if (!sheetRef.current) return;
        setIsDragging(true);
        const y = e.touches[0].clientY;
        dragStartY.current = y;
        lastY.current = y;
        lastTime.current = Date.now();
        
        // Get current transform
        const style = window.getComputedStyle(sheetRef.current);
        const matrix = new DOMMatrixReadOnly(style.transform);
        initialTranslateY.current = matrix.m42;
        setDragY(matrix.m42);
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const y = e.touches[0].clientY;
        const delta = y - dragStartY.current;
        
        const now = Date.now();
        const dt = now - lastTime.current;
        if (dt > 0) {
            velocityY.current = (y - lastY.current) / dt;
        }
        lastY.current = y;
        lastTime.current = now;

        const bounds = getHeights();
        let newY = initialTranslateY.current + delta;
        // Clamp newY
        newY = Math.max(bounds.full, Math.min(newY, bounds.collapsed));
        
        setDragY(newY);
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);

        const bounds = getHeights();
        
        // Snap logic based on velocity and position
        if (velocityY.current > 0.5) {
            // fast drag down
            snapTo('collapsed');
        } else if (velocityY.current < -0.5) {
            // fast drag up
            snapTo('full');
        } else {
            // snap based on closest distance
            const distFull = Math.abs(dragY - bounds.full);
            const distMid = Math.abs(dragY - bounds.mid);
            const distCollapsed = Math.abs(dragY - bounds.collapsed);
            
            const min = Math.min(distFull, distMid, distCollapsed);
            if (min === distFull) snapTo('full');
            else if (min === distMid) snapTo('mid');
            else snapTo('collapsed');
        }
    };

    const snapTo = (state) => {
        setSheetHeight(state);
        setDragY(null); // release manual override
    };

    // If active chat changes (e.g. from handle), collapse
    useEffect(() => {
        if (activeChat) {
            snapTo('collapsed');
        }
    }, [activeChat]);

    // Handle inline style vs class based transform
    const sheetStyle = isDragging && dragY !== null
        ? { transform: `translateY(${dragY}px)`, transition: 'none' }
        : {};

    return (
        <div className="bottom-sheet-layout">
            <div className="bottom-sheet-chat-area">
                {activeChat ? (
                    <ChatWindow onBack={() => useChatStore.getState().setActiveChat(null)} />
                ) : (
                    <div className="peek-empty-state" onClick={() => snapTo('mid')}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '10px' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <p>Pull up to start a conversation</p>
                    </div>
                )}
            </div>

            <div
                ref={sheetRef}
                className={`bottom-sheet ${sheetHeight} ${isDragging ? 'dragging' : ''}`}
                style={sheetStyle}
            >
                <div 
                    className="bottom-sheet-handle-zone" 
                    onTouchStart={handleTouchStart} 
                    onTouchMove={handleTouchMove} 
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="bottom-sheet-handle-bar" />
                    <div className="bottom-sheet-quick-avatars">
                        {sheetHeight === 'collapsed' && recentChats.slice(0, 4).map(chat => (
                            <QuickAvatarRing key={chat._id} chat={chat} />
                        ))}
                        {totalUnread > 0 && <span className="bottom-sheet-unread-pill">●{totalUnread > 99 ? '99+' : totalUnread}</span>}
                        <span className="bottom-sheet-label">CHATS</span>
                    </div>
                </div>

                <div className="bottom-sheet-content">
                    <Sidebar 
                        insideSheet={true} 
                        onChatSelect={() => snapTo('collapsed')} 
                    />
                </div>
            </div>
        </div>
    );
};

export default BottomSheetLayout;
