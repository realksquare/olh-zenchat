import { useEffect, useRef, useState, useMemo, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { useSocket } from "../../context/SocketContext";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import { formatDistanceToNow } from "date-fns";
import { VerifiedTick } from "../ui/Icons";
import UserCardModal from "../ui/UserCardModal";
import { useMomentStore } from "../../stores/momentStore";
import MediaViewerModal from "../ui/MediaViewerModal";
import MomentViewer from "./MomentViewer";
import axiosInstance from "../../utils/axios";

const EMPTY_MESSAGES = [];
const EMPTY_CONTACTS = [];


const ScrollDownBtn = ({ onClick, show, isLifted }) => (
    <button
        className={`scroll-down-btn ${show ? 'visible' : ''}`}
        style={{ marginBottom: isLifted ? '54px' : '0', transition: 'margin-bottom 0.2s ease-out' }}
        onClick={onClick}
        aria-label="Scroll to bottom"
    >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 13 12 18 17 13" />
            <polyline points="7 6 12 11 17 6" />
        </svg>
    </button>
);

const MODE_LABELS = {
    instant: 'viewing',
    '1h': '1 hour',
    '8h': '8 hours',
    '24h': '1 day',
    '7d': '7 days',
};

const DisappearingBanner = memo(({ mode, onDisable }) => {
    const lastTapRef = useRef(0);

    const handleDoubleClick = () => onDisable();

    // Mobile double-tap detection (no native dblclick on touch)
    const handleTouchEnd = (e) => {
        const now = Date.now();
        if (now - lastTapRef.current < 350) {
            e.preventDefault();
            onDisable();
        }
        lastTapRef.current = now;
    };

    return (
        <div
            onDoubleClick={handleDoubleClick}
            onTouchEnd={handleTouchEnd}
            title="Double-tap to turn off disappearing messages"
            style={{
                padding: '7px 14px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderTop: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                color: '#60a5fa',
                fontSize: '0.78rem',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
        >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>
                Disappearing messages ON &mdash; disappear after <strong>{MODE_LABELS[mode] || mode}</strong>.
                &nbsp;<span style={{ opacity: 0.6, fontSize: '0.72rem' }}>Double-tap to turn off</span>
            </span>
        </div>
    );
});



const ChatWindow = ({ onBack }) => {
    const { user } = useAuthStore();
    const contacts = useAuthStore((s) => s.user?.contacts || EMPTY_CONTACTS);
    const {
        activeChat, fetchMessages, fetchOlderMessages, isLoadingMessages, isLoadingOlderMessages,
        typingUsers, markChatAsRead, onlineUsers, hasMoreMessages
    } = useChatStore(useShallow((s) => ({
        activeChat: s.activeChat,
        fetchMessages: s.fetchMessages,
        fetchOlderMessages: s.fetchOlderMessages,
        isLoadingMessages: s.isLoadingMessages,
        isLoadingOlderMessages: s.isLoadingOlderMessages,
        typingUsers: s.typingUsers,
        markChatAsRead: s.markChatAsRead,
        onlineUsers: s.onlineUsers,
        hasMoreMessages: s.hasMoreMessages
    })));

    const hasActiveMoment = useMomentStore((s) => s.hasActiveMoment);

    const [showOnlyStarred, setShowOnlyStarred] = useState(false);
    const rawMessages = useChatStore((s) =>
        activeChat && s.messages[activeChat._id] ? s.messages[activeChat._id] : EMPTY_MESSAGES
    );

    const messages = useMemo(() => {
        const currentUserId = user?._id;
        const sorted = [...rawMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const visible = sorted.filter(m =>
            !m.deletedFor?.some(id => id?.toString() === currentUserId?.toString())
        );
        if (!showOnlyStarred) return visible;
        return visible.filter(m => m.starredBy?.includes(user?._id));
    }, [rawMessages, showOnlyStarred, user?._id]);

    const { joinChat, leaveChat, markAsRead, deleteMessage } = useSocket();
    const messagesEndRef = useRef(null);
    const isLoadingOlderRef = useRef(false);

    const [editingMessage, setEditingMessage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [deletingMessage, setDeletingMessage] = useState(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [showUserCard, setShowUserCard] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [activeViewerMoments, setActiveViewerMoments] = useState(null);
    const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
    const messagesContainerRef = useRef(null);

    const handleToggleDisappearing = async (mode) => {
        try {
            await axiosInstance.put(`/chats/${activeChat._id}/disappearing`, { mode });
            setShowDisappearingMenu(false);
            // Local state will update via socket 'chat_updated' which we need to handle in chatStore
            useChatStore.getState().updateChat(activeChat._id, { disappearingMode: mode });
        } catch (err) {
            console.error("Failed to update disappearing mode", err);
        }
    };

    const handleMessageAction = (msg) => {
        if (msg.action === "reply") {
            setReplyingTo(msg);
            setEditingMessage(null);
        } else {
            setEditingMessage(msg);
            setReplyingTo(null);
        }
    };

    const otherUser = useMemo(() =>
        activeChat?.participants?.find((p) => (p._id?.toString() || p._id) !== user?._id?.toString()),
        [activeChat, user?._id]);
    const typingScramble = useMemo(() => {
        if (!activeChat || !otherUser) return null;
        const chatTyping = typingUsers[activeChat._id];
        const otherId = otherUser._id?.toString() || otherUser._id;
        return chatTyping?.[otherId] || null;
    }, [typingUsers, activeChat?._id, otherUser?._id]);

    const hasMoments = useMemo(() => {
        if (!otherUser) return false;
        return hasActiveMoment(otherUser._id?.toString() || otherUser._id);
    }, [otherUser, hasActiveMoment]);

    const isTyping = !!typingScramble;

    const isContact = contacts.some(
        c => c.userId?.toString() === otherUser?._id?.toString() || c.userId === otherUser?._id
    );
    const displayName = otherUser?.username;

    useEffect(() => {
        if (!activeChat?._id) return;
        const chatId = activeChat._id;

        const isMobile = window.innerWidth <= 768;
        const markIfVisible = () => {
            if (isMobile && !onBack) return;
            if (!isMobile && !document.hasFocus()) return;
            markChatAsRead(chatId);
            markAsRead(chatId);
        };

        const triggerInstantCleanup = () => {
            if (activeChat?.disappearingMode === 'instant') {
                axiosInstance.delete(`/messages/${chatId}/instant`).catch(e => console.error('[instant-delete]', e));
            }
        };

        joinChat(chatId);
        fetchMessages(chatId).then(() => {
            markIfVisible();
            // On mount/re-enter: clean up any already-read instant messages (catches page refresh)
            triggerInstantCleanup();
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
                setShowScrollDown(false);
            }, 150);
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && activeChat?._id) {
                markIfVisible();
            } else if (document.visibilityState === 'hidden') {
                // User backgrounded the app/tab — purge read instant messages for both sides
                triggerInstantCleanup();
            }
        };

        window.addEventListener('focus', markIfVisible);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('focus', markIfVisible);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // Also purge on unmount (back button, switching chats)
            triggerInstantCleanup();
        };
    }, [activeChat?._id, activeChat?.disappearingMode]);

    useEffect(() => {
        setEditingMessage(null);
        setReplyingTo(null);
        setDeletingMessage(null);
    }, [activeChat?._id]);

    useEffect(() => {
        if (!showScrollDown && !isLoadingOlderRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages.length, showScrollDown]);

    useEffect(() => {
        if (isTyping && !showScrollDown) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [isTyping, showScrollDown]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        setShowScrollDown(!isNearBottom);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowScrollDown(false);
    };

    const [tick, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    const statusText = useMemo(() => {
        if (!otherUser) return "";
        const isCurrentlyOnline = otherUser.isOnline || onlineUsers.has(otherUser?._id) || onlineUsers.has(otherUser?._id?.toString());
        if (isCurrentlyOnline) return "Online";
        if (otherUser.lastSeen) {
            return `Last seen ${formatDistanceToNow(new Date(otherUser.lastSeen), { addSuffix: true })}`;
        }
        return "Offline";
    }, [otherUser, onlineUsers, tick]);

    const getStatusText = () => statusText;

    const handleDeleteConfirm = (deleteFor) => {
        if (!deletingMessage) return;
        deleteMessage(activeChat._id, deletingMessage._id, deleteFor);
        setDeletingMessage(null);
    };

    if (!activeChat) {
        return (
            <div className="chat-empty-state">
                <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <rect width="32" height="32" rx="10" fill="#1e2530" />
                    <path d="M8 10h16M8 16h10M8 22h13" stroke="#3da5d9" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                <p className="chat-empty-title">ZenChat</p>
                <span className="chat-empty-hint">Select a conversation or search for a user to start chatting</span>
            </div>
        );
    }

    return (
        <div className="chat-window">
            <div className="chat-header" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                <button className="chat-back-btn" onClick={onBack} aria-label="Back to chats">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div
                    className="chat-header-avatar-wrap"
                    onClick={() => setShowUserCard(true)}
                    style={{ cursor: 'pointer' }}
                >
                    <div
                        className={`avatar avatar-md ${hasMoments ? 'moments-halo-thin' : ''}`}
                        style={hasMoments ? { '--halo-color': useMomentStore.getState().getHaloColor(otherUser?._id, user?._id) } : {}}
                    >
                        {otherUser?.avatar ? (
                            <img src={otherUser.avatar} alt={otherUser.username} loading="lazy" />
                        ) : (
                            <span>{otherUser?.username?.slice(0, 2).toUpperCase()}</span>
                        )}
                    </div>
                    {(otherUser?.isOnline || onlineUsers.has(otherUser?._id) || onlineUsers.has(otherUser?._id?.toString())) && <span className="online-dot" />}
                </div>

                <div
                    className="chat-header-info"
                    onClick={() => setShowUserCard(true)}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="chat-header-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className={isContact ? "chat-card-name-contact" : ""} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                        {otherUser?.isVerified && <span style={{ flexShrink: 0, display: 'flex' }}><VerifiedTick /></span>}
                    </span>
                    <span className={`chat-header-status ${(otherUser?.isOnline || onlineUsers.has(otherUser?._id) || onlineUsers.has(otherUser?._id?.toString())) ? "status-online" : ""}`}>
                        {getStatusText()}
                    </span>
                </div>

                <div className="chat-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button
                        className={`header-action-btn ${showOnlyStarred ? 'active' : ''}`}
                        onClick={() => setShowOnlyStarred(!showOnlyStarred)}
                        title={showOnlyStarred ? "Show all messages" : "Show only favorites"}
                        style={{
                            background: showOnlyStarred ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
                            color: showOnlyStarred ? '#eab308' : '#94a3b8',
                            padding: '8px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={showOnlyStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button
                            className={`header-action-btn ${activeChat?.disappearingMode && activeChat.disappearingMode !== 'off' ? 'active' : ''}`}
                            onClick={() => setShowDisappearingMenu(!showDisappearingMenu)}
                            title="Disappearing Messages"
                            style={{
                                background: activeChat?.disappearingMode && activeChat.disappearingMode !== 'off' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                color: activeChat?.disappearingMode && activeChat.disappearingMode !== 'off' ? '#3b82f6' : '#94a3b8',
                                padding: '8px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </button>
                        
                        {showDisappearingMenu && (
                            <div className="message-dropdown mobile-visible" style={{ right: 0, left: 'auto', top: 'calc(100% + 8px)', minWidth: '180px', transform: 'none' }}>
                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                                    Disappearing Messages
                                </div>
                                {[
                                    { value: 'off', label: 'Off' },
                                    { value: 'instant', label: 'Instant (after view)' },
                                    { value: '1h', label: '1 Hour' },
                                    { value: '8h', label: '8 Hours' },
                                    { value: '24h', label: '1 Day' },
                                    { value: '7d', label: '7 Days' }
                                ].map(opt => (
                                    <button 
                                        key={opt.value}
                                        className="message-dropdown-item" 
                                        style={{ background: activeChat?.disappearingMode === opt.value ? 'rgba(61, 165, 217, 0.15)' : 'transparent', color: activeChat?.disappearingMode === opt.value ? '#3da5d9' : 'rgba(255,255,255,0.8)' }}
                                        onClick={() => handleToggleDisappearing(opt.value)}
                                    >
                                        {activeChat?.disappearingMode === opt.value && <span style={{ marginRight: '4px' }}>✓</span>}
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
                {(hasMoreMessages[activeChat?._id] || isLoadingOlderMessages) && !isLoadingMessages && (!showOnlyStarred || messages.length > 18) && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
                        <button
                            className="load-more-btn"
                            onClick={async () => {
                                const container = messagesContainerRef.current;
                                const prevScrollHeight = container?.scrollHeight || 0;
                                isLoadingOlderRef.current = true;
                                await fetchOlderMessages(activeChat._id);
                                isLoadingOlderRef.current = false;
                                requestAnimationFrame(() => {
                                    if (container) {
                                        container.scrollTop = container.scrollHeight - prevScrollHeight;
                                    }
                                });
                            }}
                            disabled={isLoadingOlderMessages}
                        >
                            {isLoadingOlderMessages ? (
                                <span className="banner-spinner" style={{ width: 14, height: 14 }} />
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="17 11 12 6 7 11" />
                                    <polyline points="17 18 12 13 7 18" />
                                </svg>
                            )}
                            {isLoadingOlderMessages ? 'Loading...' : 'Load older messages'}
                        </button>
                    </div>
                )}
                {isLoadingMessages && (
                    <div className="messages-loading">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className={`message-skeleton ${i % 2 === 0 ? "mine" : ""}`}>
                                <div className="skeleton skeleton-bubble" style={{ width: `${[55, 40, 65, 35][i - 1]}%` }} />
                            </div>
                        ))}
                    </div>
                )}

                {!isLoadingMessages && messages.length === 0 && (
                    <div className="messages-empty">
                        <span>{showOnlyStarred ? 'No messages marked as "Fav"' : 'No messages yet - say Hi!'}</span>
                    </div>
                )}

                {!isLoadingMessages && messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    const msgDate = new Date(msg.createdAt).toLocaleDateString();
                    const prevDate = prevMsg ? new Date(prevMsg.createdAt).toLocaleDateString() : null;
                    const showDateDivider = msgDate !== prevDate;

                    return (
                        <div key={`wrap-${msg._id}`} style={{ display: 'contents' }}>
                            {showDateDivider && (
                                <div className="message-date-divider" style={{ textAlign: 'center', margin: '20px 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                    <span style={{ background: 'rgba(30, 37, 48, 0.6)', padding: '6px 14px', borderRadius: '16px', backdropFilter: 'blur(4px)' }}>
                                        {new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: new Date(msg.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}
                                    </span>
                                </div>
                            )}
                            <MessageBubble
                                key={msg._id}
                                message={msg}
                                isMe={msg.senderId?._id === user?._id || msg.senderId === user?._id}
                                showAvatar={idx === 0 || messages[idx - 1]?.senderId?._id !== msg.senderId?._id || showDateDivider}
                                otherUser={otherUser}
                                onEdit={handleMessageAction}
                                onDelete={setDeletingMessage}
                                onMediaClick={(url, type) => {
                                    const senderName = (msg.senderId?._id === user?._id || msg.senderId === user?._id) 
                                        ? "me" 
                                        : (msg.senderId?.username || otherUser?.username || "user");
                                    setSelectedMedia({ url, type, username: senderName });
                                }}
                            />
                        </div>
                    );
                })}

                {isTyping && <TypingIndicator scramble={typeof typingScramble === "string" ? typingScramble : ""} />}
                <div ref={messagesEndRef} />
            </div>
            <ScrollDownBtn onClick={scrollToBottom} show={showScrollDown} isLifted={!!replyingTo} />

            {activeChat?.disappearingMode && activeChat.disappearingMode !== 'off' && !showOnlyStarred && (
                <DisappearingBanner
                    mode={activeChat.disappearingMode}
                    onDisable={() => handleToggleDisappearing('off')}
                />
            )}

            <MessageInput
                chatId={activeChat._id}
                editingMessage={editingMessage}
                replyingTo={replyingTo}
                onCancelEdit={() => setEditingMessage(null)}
                onCancelReply={() => setReplyingTo(null)}
                disabled={showOnlyStarred}
            />

            {deletingMessage && (
                <div className="delete-modal-overlay" onClick={() => setDeletingMessage(null)}>
                    <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
                        <p className="delete-modal-title">Delete message?</p>
                        <p className="delete-modal-subtitle">This action cannot be undone.</p>
                        <div className="delete-modal-actions">
                            <button className="delete-modal-btn cancel" onClick={() => setDeletingMessage(null)}>
                                Cancel
                            </button>
                            <button className="delete-modal-btn self" onClick={() => handleDeleteConfirm("self")}>
                                Delete for me
                            </button>
                            <button className="delete-modal-btn everyone" onClick={() => handleDeleteConfirm("everyone")}>
                                Delete for everyone
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <UserCardModal
                isOpen={showUserCard}
                onClose={() => setShowUserCard(false)}
                user={otherUser}
                isOnline={otherUser?.isOnline || onlineUsers.has(otherUser?._id) || onlineUsers.has(otherUser?._id?.toString())}
                hasMoments={hasMoments}
                isContact={isContact}
                onViewMoments={() => {
                    const moments = useMomentStore.getState().moments.filter(m => (m.userId?._id || m.userId)?.toString() === otherUser?._id?.toString());
                    setActiveViewerMoments(moments);
                    setShowUserCard(false);
                }}
            />

            <MomentViewer 
                moments={activeViewerMoments || []}
                isOpen={!!activeViewerMoments}
                onClose={() => setActiveViewerMoments(null)}
            />

            {selectedMedia && (
                <MediaViewerModal
                    url={selectedMedia.url}
                    type={selectedMedia.type}
                    username={selectedMedia.username}
                    onClose={() => setSelectedMedia(null)}
                />
            )}
        </div>
    );
};

export default memo(ChatWindow);