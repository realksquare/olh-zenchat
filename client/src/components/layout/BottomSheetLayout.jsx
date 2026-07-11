import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ChatWindow from '../chat/ChatWindow';
import Sidebar from '../chat/Sidebar';
import { useChatStore } from '../../stores/chatStore';
import { useMomentStore } from '../../stores/momentStore';
import { useAuthStore } from '../../stores/authStore';
import ZenTimeDashboard from './ZenTimeDashboard';
import ZenVoiceVerifyModal from '../zenvoice/ZenVoiceVerifyModal';
import ZenVoiceRoomBrowser from '../zenvoice/ZenVoiceRoomBrowser';
import ZenVoiceRoom from '../zenvoice/ZenVoiceRoom';
import { useZenVoiceStore } from '../../stores/zenVoiceStore';

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

const getInitials = (name) => {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
};

const BottomSheetLayout = () => {
    const user = useAuthStore(s => s.user);
    const hasActiveMoment = useMomentStore(s => s.hasActiveMoment);
    const getHaloColor = useMomentStore(s => s.getHaloColor);
    const [sheetHeight, setSheetHeight] = useState('collapsed'); // 'collapsed' | 'mid' | 'full'
    const [isDragging, setIsDragging] = useState(false);
    const [glitchKey, setGlitchKey] = useState(0);

    const [activeView, setActiveView] = useState('zenchat');
    const [viewTransitioning, setViewTransitioning] = useState(false);
    const [zvActiveRoomId, setZvActiveRoomId] = useState(null);
    const [zvShowVerifier, setZvShowVerifier] = useState(false);

    const { isVerified, checkStatus, sessionToken } = useZenVoiceStore();

    const switchToZenVoice = async () => {
        setViewTransitioning(true);
        const statusRes = await checkStatus();
        if (statusRes?.success && statusRes?.isVerified) {
            setZvShowVerifier(false);
        } else {
            setZvShowVerifier(true);
        }
        
        setTimeout(() => {
            setActiveView('zenvoice');
            setViewTransitioning(false);
        }, 150);
    };

    const switchToZenChat = () => {
        setViewTransitioning(true);
        setTimeout(() => {
            setActiveView('zenchat');
            setZvActiveRoomId(null);
            setViewTransitioning(false);
        }, 150);
    };

    const handleDMBridgeSuccess = (chatId) => {
        const { chats } = useChatStore.getState();
        const found = chats.find(c => c._id === chatId);
        if (found) {
            useChatStore.getState().setActiveChat(found);
            switchToZenChat();
        }
    };

    useEffect(() => {
        const handleSwitchEvent = () => {
            switchToZenVoice();
        };
        window.addEventListener("switch-to-zenvoice", handleSwitchEvent);
        return () => window.removeEventListener("switch-to-zenvoice", handleSwitchEvent);
    }, []);

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
            collapsed: sheetMax - 72, // 72px exposed
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
            const t = setTimeout(() => {
                snapTo('collapsed');
            }, 80);
            return () => clearTimeout(t);
        }
    }, [activeChat]);

    // Handle inline style vs class based transform
    const sheetStyle = isDragging && dragY !== null
        ? { transform: `translateY(${dragY}px)`, transition: 'none' }
        : {};

    const isSheetUp = sheetHeight !== 'collapsed' || (isDragging && dragY !== null && dragY < getHeights().collapsed - 12);

    return (
        <div className="bottom-sheet-layout">
            {(!activeChat || activeView === 'zenvoice') && (
                <div className="mobile-top-header">
                    {activeView === 'zenvoice' ? (
                        <button
                            onClick={zvActiveRoomId ? () => setZvActiveRoomId(null) : switchToZenChat}
                            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>
                    ) : (
                        <div
                            className={`avatar avatar-sm ${hasActiveMoment(user?._id) ? 'moments-halo-thin' : ''}`}
                            onClick={() => window.dispatchEvent(new CustomEvent("open-profile-modal"))}
                            style={{
                                cursor: "pointer",
                                ...(hasActiveMoment(user?._id) ? { '--halo-color': getHaloColor(user?._id, user?._id) } : {})
                            }}
                            title="Edit Profile"
                        >
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.username} />
                            ) : (
                                <span>{getInitials(user?.username)}</span>
                            )}
                        </div>
                    )}
                    <div className="mobile-header-title">
                        <span
                            key={activeView === 'zenvoice' ? 'title-zv' : 'title-zc'}
                            className="glitch-effect"
                            onClick={activeView === 'zenvoice' ? switchToZenChat : switchToZenVoice}
                            style={{ cursor: 'pointer', display: 'inline-block', color: activeView === 'zenvoice' ? '#f59e0b' : 'inherit' }}
                        >
                            {activeView === 'zenvoice' ? '#ZenVoice' : 'ZenChat'}
                        </span>
                    </div>
                    <div className="mobile-header-actions">
                        {activeView === 'zenvoice' ? (
                            null
                        ) : (
                            <>
                                <button
                                    className="mobile-header-btn"
                                    onClick={() => window.dispatchEvent(new CustomEvent("open-theme-modal"))}
                                    aria-label="Themes"
                                    title="Themes"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" />
                                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                                    </svg>
                                </button>
                                <button
                                    className="mobile-header-btn"
                                    onClick={() => window.dispatchEvent(new CustomEvent("open-mobile-menu"))}
                                    aria-label="Menu"
                                    title="Menu"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="3" y1="12" x2="21" y2="12" />
                                        <line x1="3" y1="6" x2="21" y2="6" />
                                        <line x1="3" y1="18" x2="21" y2="18" />
                                    </svg>
                                </button>
                                <button
                                    className="mobile-header-btn logout"
                                    onClick={() => window.dispatchEvent(new CustomEvent("confirm-logout"))}
                                    aria-label="Sign out"
                                    title="Sign out"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
            <div className={`bottom-sheet-chat-area ${viewTransitioning ? 'transition-fade-out' : 'transition-fade-in'}`}>
                {activeView === 'zenvoice' ? (
                    zvShowVerifier ? (
                        <ZenVoiceVerifyModal
                            isOpen={true}
                            onClose={switchToZenChat}
                            onVerificationSuccess={() => setZvShowVerifier(false)}
                        />
                    ) : zvActiveRoomId ? (
                        <ZenVoiceRoom roomId={zvActiveRoomId} onBack={() => setZvActiveRoomId(null)} onDMBridgeSuccess={handleDMBridgeSuccess} />
                    ) : (
                        <ZenVoiceRoomBrowser onBack={switchToZenChat} onRoomSelect={(id) => setZvActiveRoomId(id)} />
                    )
                ) : activeChat ? (
                    <ChatWindow onBack={() => useChatStore.getState().setActiveChat(null)} />
                ) : (
                    <ZenTimeDashboard snapTo={snapTo} />
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
                    <div className="bottom-sheet-handle-bar nudge-icon" style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "none", height: "auto", gap: "1px", paddingTop: "4px", paddingBottom: "2px", overflow: "visible" }}>
                        <svg
                            width="10"
                            height="6"
                            viewBox="0 0 14 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                transform: sheetHeight === 'collapsed' ? 'rotate(0deg)' : 'rotate(180deg)',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                color: 'var(--color-text-muted, #94a3b8)'
                            }}
                        >
                            <polyline points="1 7 7 1 13 7" />
                        </svg>
                        <svg
                            width="10"
                            height="6"
                            viewBox="0 0 14 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                transform: sheetHeight === 'collapsed' ? 'rotate(0deg)' : 'rotate(180deg)',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                color: 'var(--color-text-muted, #94a3b8)',
                                marginTop: "-2px"
                            }}
                        >
                            <polyline points="1 7 7 1 13 7" />
                        </svg>
                    </div>
                    <div className={`bottom-sheet-quick-avatars ${isSheetUp ? 'faded-out' : ''}`}>
                        {recentChats.length > 0 ? (
                            <>
                                {recentChats.slice(0, 8).map(chat => (
                                    <QuickAvatarRing key={chat._id} chat={chat} />
                                ))}
                                {totalUnread > 0 && <span className="bottom-sheet-unread-pill">●{totalUnread > 99 ? '99+' : totalUnread}</span>}
                            </>
                        ) : (
                            <span className="quick-avatars-empty-text">Pull up to find & connect with users...</span>
                        )}
                    </div>
                    <div className={`bottom-sheet-chats-title ${isSheetUp ? 'faded-in' : ''}`}>
                        #MOMENTS & CHATS
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
