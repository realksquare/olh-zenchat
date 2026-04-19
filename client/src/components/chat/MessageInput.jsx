import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "../../context/SocketContext";
import { playSendSound } from "../../utils/audio";

const MessageInput = ({ chatId, editingMessage, onCancelEdit }) => {
    const [content, setContent] = useState("");
    const { sendMessage, startTyping, stopTyping, editMessage } = useSocket();
    const textareaRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const adjustHeight = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    useEffect(() => {
        adjustHeight();
    }, [content]);

    useEffect(() => {
        if (editingMessage) {
            setContent(editingMessage.content);
            textareaRef.current?.focus();
        } else {
            setContent("");
        }
    }, [editingMessage]);

    const handleTypingStart = useCallback(() => {
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            startTyping(chatId);
        }
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            stopTyping(chatId);
        }, 1500);
    }, [chatId, startTyping, stopTyping]);

    useEffect(() => {
        return () => {
            clearTimeout(typingTimeoutRef.current);
            if (isTypingRef.current) {
                stopTyping(chatId);
            }
        };
    }, [chatId]);

    const handleChange = (e) => {
        setContent(e.target.value);
        if (!editingMessage) handleTypingStart();
    };

    const handleSend = () => {
        const trimmed = content.trim();
        if (!trimmed) return;

        if (editingMessage) {
            if (trimmed !== editingMessage.content) {
                editMessage(chatId, editingMessage._id, trimmed);
            }
            onCancelEdit();
        } else {
            sendMessage(chatId, trimmed);
            playSendSound();
        }

        setContent("");
        clearTimeout(typingTimeoutRef.current);
        isTypingRef.current = false;
        stopTyping(chatId);
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        if (e.key === "Escape" && editingMessage) {
            onCancelEdit();
        }
    };

    return (
        <div className="message-input-wrap">
            {editingMessage && (
                <div className="editing-banner">
                    <span>✏️ Editing message</span>
                    <button className="editing-cancel-btn" onClick={onCancelEdit}>
                        ✕ Cancel
                    </button>
                </div>
            )}
            <div className="message-input-box">
                <textarea
                    ref={textareaRef}
                    className="message-textarea"
                    placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
                    value={content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    aria-label="Message input"
                />
                <button
                    className={`send-btn ${content.trim() ? "send-btn-active" : ""}`}
                    onClick={handleSend}
                    disabled={!content.trim()}
                    aria-label={editingMessage ? "Save edit" : "Send message"}
                >
                    {editingMessage ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    )}
                </button>
            </div>
            <span className="input-hint">Enter to send · Shift+Enter for new line{editingMessage ? " · Esc to cancel" : ""}</span>
        </div>
    );
};

export default MessageInput;