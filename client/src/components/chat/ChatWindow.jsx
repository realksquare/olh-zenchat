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

const EMPTY_MESSAGES = [];
const EMPTY_CONTACTS = [];

const ScrollDownBtn = ({ onClick, show }) => (
    <button 
        className={`scroll-down-btn ${show ? 'visible' : ''}`}
        onClick={onClick}
        aria-label="Scroll to bottom"
    >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 13 12 18 17 13" />
            <polyline points="7 6 12 11 17 6" />
        </svg>
    </button>
);

const ChatWindow = ({ onBack }) => {
    const { user } = useAuthStore();
    const contacts = useAuthStore((s) => s.user?.contacts || EMPTY_CONTACTS);
    const { 
        activeChat, fetchMessages, isLoadingMessages, 
        typingUsers, markChatAsRead, onlineUsers 
    } = useChatStore(useShallow((s) => ({
        activeChat: s.activeChat,
        fetchMessages: s.fetchMessages,
        isLoadingMessages: s.isLoadingMessages,
        typingUsers: s.typingUsers,
        markChatAsRead: s.markChatAsRead,
        onlineUsers: s.onlineUsers
    })));

    const hasActiveMoment = useMomentStore((s) => s.hasActiveMoment);

    const [showOnlyStarred, setShowOnlyStarred] = useState(false);
    const rawMessages = useChatStore((s) =>
        activeChat && s.messages[activeChat._id] ? s.messages[activeChat._id] : EMPTY_MESSAGES
    );
    
    const messages = useMemo(() => {
        const sorted = [...rawMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        if (!showOnlyStarred) return sorted;
        return sorted.filter(m => m.starredBy?.includes(user?._id));
    }, [rawMessages, showOnlyStarred, user?._id]);

    const { joinChat, leaveChat, markAsRead, deleteMessage } = useSocket();
    const messagesEndRef = useRef(null);

    const [editingMessage, setEditingMessage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [deletingMessage, setDeletingMessage] = useState(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [showUserCard, setShowUserCard] = useState(false);
    const messagesContainerRef = useRef(null);

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
    const displayName = isContact ? `${otherUser?.username} ✨` : otherUser?.username;

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

        joinChat(chatId);
        fetchMessages(chatId).then(() => {
            markIfVisible();
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
                setShowScrollDown(false);
            }, 150);
        });
        window.addEventListener('focus', markIfVisible);
        return () => window.removeEventListener('focus', markIfVisible);
    }, [activeChat?._id]);

    useEffect(() => {
        setEditingMessage(null);
        setReplyingTo(null);
        setDeletingMessage(null);
    }, [activeChat?._id]);

    useEffect(() => {
        if (!showScrollDown) {
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
                    <span className="chat-header-name">
                        {displayName}
                        {otherUser?.isVerified && <VerifiedTick />}
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
                </div>
            </div>

            <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
                <ScrollDownBtn onClick={scrollToBottom} show={showScrollDown} />
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
                        <span>No messages yet - say Hi!</span>
                    </div>
                )}

                {!isLoadingMessages && messages.map((msg, idx) => (
                    <MessageBubble
                        key={msg._id}
                        message={msg}
                        isMe={msg.senderId?._id === user?._id || msg.senderId === user?._id}
                        showAvatar={idx === 0 || messages[idx - 1]?.senderId?._id !== msg.senderId?._id}
                        otherUser={otherUser}
                        onEdit={handleMessageAction}
                        onDelete={setDeletingMessage}
                    />
                ))}

                {isTyping && <TypingIndicator scramble={typeof typingScramble === "string" ? typingScramble : ""} />}
                <div ref={messagesEndRef} />
            </div>

            <MessageInput
                chatId={activeChat._id}
                editingMessage={editingMessage}
                replyingTo={replyingTo}
                onCancelEdit={() => setEditingMessage(null)}
                onCancelReply={() => setReplyingTo(null)}
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
            />
        </div>
    );
};

export default memo(ChatWindow);