import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { useSocket } from "../../context/SocketContext";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import { formatDistanceToNow } from "date-fns";

const EMPTY_MESSAGES = [];

const ChatWindow = ({ onBack }) => {
    const { user } = useAuthStore();
    const activeChat = useChatStore((s) => s.activeChat);
    const fetchMessages = useChatStore((s) => s.fetchMessages);
    const isLoadingMessages = useChatStore((s) => s.isLoadingMessages);
    const isUserTypingInChat = useChatStore((s) => s.isUserTypingInChat);
    const markChatAsRead = useChatStore((s) => s.markChatAsRead);
    const onlineUsers = useChatStore((s) => s.onlineUsers);

    const rawMessages = useChatStore((s) =>
        activeChat && s.messages[activeChat._id] ? s.messages[activeChat._id] : EMPTY_MESSAGES
    );
    const messages = [...rawMessages];

    const { joinChat, leaveChat, markAsRead, deleteMessage } = useSocket();
    const messagesEndRef = useRef(null);

    const [editingMessage, setEditingMessage] = useState(null);
    const [deletingMessage, setDeletingMessage] = useState(null);

    const otherUser = activeChat?.participants?.find((p) => p._id !== user?._id);
    const isTyping = activeChat ? isUserTypingInChat(activeChat._id, otherUser?._id) : false;

    useEffect(() => {
        if (!activeChat) return;

        joinChat(activeChat._id);
        fetchMessages(activeChat._id);
        markChatAsRead(activeChat._id);

        const timer = setTimeout(() => {
            markAsRead(activeChat._id);
        }, 300);

        return () => {
            clearTimeout(timer);
            leaveChat(activeChat._id);
        };
    }, [activeChat?._id]);

    useEffect(() => {
        setEditingMessage(null);
        setDeletingMessage(null);
    }, [activeChat?._id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, isTyping]);

    const getStatusText = () => {
        if (!otherUser) return "";
        const isCurrentlyOnline = otherUser.isOnline || onlineUsers.has(otherUser?._id);
        if (isCurrentlyOnline) return "Online";
        if (otherUser.lastSeen) {
            return `Last seen ${formatDistanceToNow(new Date(otherUser.lastSeen), { addSuffix: true })}`;
        }
        return "Offline";
    };

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
            <div className="chat-header">
                <button className="chat-back-btn" onClick={onBack} aria-label="Back to chats">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div className="chat-header-avatar-wrap">
                    <div className="avatar avatar-md">
                        {otherUser?.avatar ? (
                            <img src={otherUser.avatar} alt={otherUser.username} loading="lazy" />
                        ) : (
                            <span>{otherUser?.username?.slice(0, 2).toUpperCase()}</span>
                        )}
                    </div>
                    {(otherUser?.isOnline || onlineUsers.has(otherUser?._id)) && <span className="online-dot" />}
                </div>

                <div className="chat-header-info">
                    <span className="chat-header-name">{otherUser?.username}</span>
                    <span className={`chat-header-status ${(otherUser?.isOnline || onlineUsers.has(otherUser?._id)) ? "status-online" : ""}`}>
                        {getStatusText()}
                    </span>
                </div>
            </div>

            <div className="chat-messages">
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
                        <span>No messages yet - say Hi! 👋</span>
                    </div>
                )}

                {!isLoadingMessages && messages.map((msg, idx) => (
                    <MessageBubble
                        key={msg._id}
                        message={msg}
                        isMe={msg.senderId?._id === user?._id || msg.senderId === user?._id}
                        showAvatar={idx === 0 || messages[idx - 1]?.senderId?._id !== msg.senderId?._id}
                        otherUser={otherUser}
                        onEdit={setEditingMessage}
                        onDelete={setDeletingMessage}
                    />
                ))}

                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </div>

            <MessageInput
                chatId={activeChat._id}
                editingMessage={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
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
        </div>
    );
};

export default ChatWindow;