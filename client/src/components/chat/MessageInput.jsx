import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSocket } from "../../context/SocketContext";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { playSendSound } from "../../utils/audio";
import axiosInstance from "../../utils/axios";
import axios from "axios";

const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm", "video/mpeg", "video/x-msvideo"];
const ACCEPTED_ALL = [...ACCEPTED_IMAGE, ...ACCEPTED_VIDEO];
const MAX_FILES = 3;

const VULGAR_WORDS = ["offensive", "vulgar", "badword1", "badword2"];

const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MediaUploadPopup = ({ onClose, onFilesSelected }) => {
    const fileInputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    const validate = (files) => {
        const valid = [];
        const errors = [];
        for (const file of files) {
            if (!ACCEPTED_ALL.includes(file.type)) {
                errors.push(`${file.name}: unsupported format`);
                continue;
            }
            const isVideo = ACCEPTED_VIDEO.includes(file.type);
            const limit = isVideo ? 7 * 1024 * 1024 : 3 * 1024 * 1024;
            if (file.size > limit) {
                errors.push(`${file.name}: exceeds ${isVideo ? "7 MB" : "3 MB"} limit`);
                continue;
            }
            valid.push(file);
        }
        return { valid, errors };
    };

    const handleFiles = (files) => {
        const list = Array.from(files).slice(0, MAX_FILES);
        const { valid, errors } = validate(list);
        if (errors.length) alert("Some files were skipped:\n" + errors.join("\n"));
        if (valid.length) onFilesSelected(valid);
        onClose();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="media-upload-popup"
                onClick={(e) => e.stopPropagation()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                <div className="media-upload-header">
                    <span className="media-upload-title">Media Upload</span>
                    <button className="media-upload-close" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <p className="media-upload-hint">
                    Supported: JPG, PNG, WEBP, GIF (max 3 MB) &bull; MP4, MOV, WEBM, MPEG, AVI (max 7 MB)
                </p>
                <p className="media-upload-limit">Up to {MAX_FILES} files per message</p>

                <div
                    className={`media-upload-dropzone ${dragOver ? "dragover" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 8 }}>
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Click or drag & drop to upload</span>
                    <span className="media-upload-sub">Select up to {MAX_FILES} files</span>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_ALL.join(",")}
                    style={{ display: "none" }}
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>
        </div>,
        document.body
    );
};

const MediaPreview = ({ files, onRemove }) => {
    if (!files.length) return null;
    return (
        <div className="media-preview-strip">
            {files.map((f, i) => {
                const isVideo = ACCEPTED_VIDEO.includes(f.type);
                const url = URL.createObjectURL(f);
                return (
                    <div key={i} className="media-preview-item">
                        {isVideo ? (
                            <video src={url} className="media-preview-thumb" muted />
                        ) : (
                            <img src={url} alt={f.name} className="media-preview-thumb" />
                        )}
                        <span className="media-preview-name">{formatFileSize(f.size)}</span>
                        <button className="media-preview-remove" onClick={() => onRemove(i)} title="Remove">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

const MessageInput = ({ chatId, editingMessage, replyingTo, onCancelEdit, onCancelReply }) => {
    const [content, setContent] = useState("");
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showMediaPopup, setShowMediaPopup] = useState(false);
    const [stagedFiles, setStagedFiles] = useState([]);
    const { sendMessage, startTyping, stopTyping, editMessage } = useSocket();
    const { addMessage, updateMessage } = useChatStore();
    const { user, soundEnabled } = useAuthStore();
    const textareaRef = useRef(null);
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

    const uploadAndSend = async (files, textContent) => {
        setUploading(true);
        try {
            const cloudName = "du4nvei7j";
            const uploadPreset = "ml_default";

            for (const file of files) {
                const isVideo = ACCEPTED_VIDEO.includes(file.type);
                const tempId = `temp-${Date.now()}-${Math.random()}`;
                
                // Create optimistic message
                addMessage(chatId, {
                    _id: tempId,
                    chatId,
                    senderId: user?._id,
                    content: files.length === 1 ? textContent : "", // Only add caption to first if single file
                    type: isVideo ? "video" : "image",
                    mediaUrl: URL.createObjectURL(file), // Local blob for preview
                    status: "sending",
                    progress: 0,
                    replyTo: replyingTo?._id,
                    createdAt: new Date().toISOString()
                });

                const formData = new FormData();
                formData.append("file", file);
                formData.append("upload_preset", uploadPreset);

                const res = await axios.post(
                    `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? 'video' : 'image'}/upload`,
                    formData,
                    {
                        onUploadProgress: (p) => {
                            const percent = Math.round((p.loaded * 100) / p.total);
                            updateMessage(chatId, { _id: tempId, progress: percent });
                        }
                    }
                );

                const downloadURL = res.data.secure_url;
                // Replace temp message or just send real one
                sendMessage(chatId, files.length === 1 ? textContent : "", isVideo ? "video" : "image", downloadURL, replyingTo?._id, isViewOnce);
                // We'll let the socket event update/remove the temp message naturally if IDs match, 
                // but usually the socket returns a new message. For now, we just send.
            }
            if (soundEnabled) playSendSound();
            onCancelReply(); // Clear reply after sending
        } catch (error) {
            const errorDetail = error.response?.data?.error?.message || error.message;
            console.error("Cloudinary Detailed Error:", error.response?.data || error);
            alert(`Upload failed: ${errorDetail}. \n\nCheck console for details.`);
        } finally {
            setUploading(false);
            setStagedFiles([]);
            setIsViewOnce(false);
        }
    };

    const handleSend = async () => {
        const filteredContent = filterOffensive(content.trim());

        if (stagedFiles.length > 0) {
            await uploadAndSend(stagedFiles, filteredContent);
            if (filteredContent) {
                sendMessage(chatId, filteredContent, "text", "", null, false);
            }
            setContent("");
            clearTyping();
            return;
        }

        if (!filteredContent) return;
        if (isViewOnce && !filteredContent) return;

        if (editingMessage) {
            if (filteredContent !== editingMessage.content) {
                editMessage(chatId, editingMessage._id, filteredContent);
            }
            onCancelEdit();
        } else {
            sendMessage(chatId, filteredContent, "text", "", replyingTo?._id, false);
            if (soundEnabled) playSendSound();
            onCancelReply();
        }

        setContent("");
        setIsViewOnce(false);
        clearTyping();
        textareaRef.current?.focus();
    };

    const clearTyping = () => {
        clearTimeout(typingTimeoutRef.current);
        isTypingRef.current = false;
        stopTyping(chatId);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        if (e.key === "Escape" && editingMessage) onCancelEdit();
    };

    const handleFilesSelected = (files) => {
        setStagedFiles(prev => {
            const combined = [...prev, ...files];
            return combined.slice(0, MAX_FILES);
        });
    };

    const removeFile = (index) => {
        setStagedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const hasMedia = stagedFiles.length > 0;
    const sendDisabled = uploading || (!content.trim() && !hasMedia) || (isViewOnce && !hasMedia);

    return (
        <div className="message-input-wrap">
            {editingMessage && (
                <div className="editing-banner">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>Editing message</span>
                </div>
            )}

            {replyingTo && (
                <div className="reply-preview-container">
                    <div className="reply-info">
                        <div className="reply-to-user">
                            Replying to {replyingTo.senderId === user?._id ? "yourself" : "them"}
                        </div>
                        <div className="reply-to-text">
                            {replyingTo.type === "image" ? "Image" : 
                             replyingTo.type === "video" ? "Video" : 
                             replyingTo.content}
                        </div>
                    </div>
                    <button className="reply-cancel-btn" onClick={onCancelReply}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {hasMedia && (
                <MediaPreview files={stagedFiles} onRemove={removeFile} />
            )}

            <div className="message-input-box">
                <button
                    className="attachment-btn"
                    onClick={() => setShowMediaPopup(true)}
                    disabled={uploading || hasMedia >= MAX_FILES}
                    title="Attach media"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    {hasMedia && <span className="attachment-badge">{stagedFiles.length}</span>}
                </button>

                <button
                    className={`view-once-btn ${isViewOnce ? "active" : ""}`}
                    onClick={() => setIsViewOnce(!isViewOnce)}
                    disabled={uploading}
                    title={isViewOnce ? "View-Once ON - for uploaded media" : "Enable View-Once for media"}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>

                <textarea
                    ref={textareaRef}
                    className="message-textarea"
                    placeholder={
                        uploading ? "Uploading..." :
                            hasMedia ? "Add a caption (optional)..." :
                                isViewOnce ? "Upload a file to send view-once media..." :
                                    editingMessage ? "Edit your message..." :
                                        "Type a message..."
                    }
                    value={content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    disabled={uploading || (isViewOnce && !hasMedia)}
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
                    {editingMessage ? " | Esc to cancel" : ""}
                </span>
                {isViewOnce && (
                    <span className="view-once-hint">View Once is active for media</span>
                )}
            </div>

            {showMediaPopup && (
                <MediaUploadPopup
                    onClose={() => setShowMediaPopup(false)}
                    onFilesSelected={handleFilesSelected}
                />
            )}
        </div>
    );
};

export default MessageInput;