import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "../../context/SocketContext";
import { playSendSound } from "../../utils/audio";
import axiosInstance from "../../utils/axios";

const VULGAR_WORDS = ["offensive", "vulgar", "badword1", "badword2"];

const MessageInput = ({ chatId, editingMessage, onCancelEdit }) => {
    const [content, setContent] = useState("");
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [uploading, setUploading] = useState(false);
    const { sendMessage, startTyping, stopTyping, editMessage } = useSocket();
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const adjustHeight = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    useEffect(() => { adjustHeight(); }, [content]);

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
            if (isTypingRef.current) stopTyping(chatId);
        };
    }, [chatId]);

    const handleChange = (e) => {
        setContent(e.target.value);
        if (!editingMessage) handleTypingStart();
    };

    const filterOffensive = (text) => {
        let filtered = text;
        VULGAR_WORDS.forEach(word => {
            filtered = filtered.replace(new RegExp(word, "gi"), "****");
        });
        return filtered;
    };

    const handleSend = async () => {
        const filteredContent = filterOffensive(content.trim());
        if (!filteredContent && !uploading) return;
        if (isViewOnce && !filteredContent) return;

        if (editingMessage) {
            if (filteredContent !== editingMessage.content) {
                editMessage(chatId, editingMessage._id, filteredContent);
            }
            onCancelEdit();
        } else {
            sendMessage(chatId, filteredContent, "text", "", null, false);
            playSendSound();
        }

        setContent("");
        setIsViewOnce(false);
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
        if (e.key === "Escape" && editingMessage) onCancelEdit();
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const maxSize = isImage ? 3 * 1024 * 1024 : 7 * 1024 * 1024;

        if (file.size > maxSize) {
            alert(`File too large. Max ${isImage ? "3MB for images" : "7MB for videos"}.`);
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const { data } = await axiosInstance.post(`/messages/${chatId}/upload`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            sendMessage(chatId, "", isImage ? "image" : "video", data.mediaUrl, null, isViewOnce);
            playSendSound();
            setIsViewOnce(false);
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload media. Please try again.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const sendDisabled = uploading || (!content.trim() && !uploading) || (isViewOnce && !content.trim());

    return (
        <div className="message-input-wrap">
            {editingMessage && (
                <div className="editing-banner">
                    <span>✏️ Editing message</span>
                    <button className="editing-cancel-btn" onClick={onCancelEdit}>✕ Cancel</button>
                </div>
            )}
            <div className="message-input-box">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                    accept="image/*,video/*"
                />

                <button
                    className="attachment-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Attach image or video"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                </button>

                <button
                    className={`view-once-btn ${isViewOnce ? "active" : ""}`}
                    onClick={() => setIsViewOnce(!isViewOnce)}
                    disabled={uploading}
                    title={isViewOnce ? "View-Once ON (for next upload)" : "Enable View-Once for next media upload"}
                >
                    👁️
                </button>

                <textarea
                    ref={textareaRef}
                    className="message-textarea"
                    placeholder={
                        uploading ? "Uploading..." :
                            isViewOnce ? "Upload a file to send view-once media..." :
                                editingMessage ? "Edit your message..." :
                                    "Type a message..."
                    }
                    value={content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    disabled={uploading || isViewOnce}
                    rows={1}
                    aria-label="Message input"
                />

                <button
                    className={`send-btn ${!sendDisabled ? "send-btn-active" : ""}`}
                    onClick={handleSend}
                    disabled={sendDisabled}
                    aria-label={editingMessage ? "Save edit" : "Send message"}
                >
                    {uploading ? (
                        <div className="loader-sm" />
                    ) : editingMessage ? (
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

            <div className="input-hint-row">
                <span className="input-hint desktop-only">
                    Enter to send | Shift+Enter for new line
                    {editingMessage ? " · Esc to cancel" : ""}
                </span>
                {isViewOnce && (
                    <span className="view-once-hint">👁️ View Once - upload a file</span>
                )}
            </div>
        </div>
    );
};

export default MessageInput;