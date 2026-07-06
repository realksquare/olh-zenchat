import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSocket } from "../../context/SocketContext";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { playSendSound } from "../../utils/audio";
import axiosInstance from "../../utils/axios";
import axios from "axios";
import { enqueuePendingMedia } from "../../db/zenDB";
import { generateLQIP } from "../../utils/lqip";
import GifPicker from "./GifPicker";
import VoiceRecorder from "./VoiceRecorder";
import { loadModel, trainOnMessage, getSmartStart, getWordSuggestion, getNextWordSuggestion } from "../../utils/autocomplete";

const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm", "video/mpeg", "video/x-msvideo"];
const ACCEPTED_RAW = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "text/plain",
    "application/octet-stream"
];
const ACCEPTED_ALL = [...ACCEPTED_IMAGE, ...ACCEPTED_VIDEO, ...ACCEPTED_RAW];
const MAX_FILES = 3;

const isImageFile = (file) => {
    if (!file) return false;
    const type = file.type || "";
    const name = file.name ? file.name.toLowerCase() : "";
    return ACCEPTED_IMAGE.includes(type) || !!name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
};

const isVideoFile = (file) => {
    if (!file) return false;
    const type = file.type || "";
    const name = file.name ? file.name.toLowerCase() : "";
    return ACCEPTED_VIDEO.includes(type) || !!name.match(/\.(mp4|mov|webm|mpeg|avi|mkv)$/i);
};

const compressImage = (file, targetKB = 300) => new Promise((resolve) => {
    if (!isImageFile(file) || file.type === "image/gif") return resolve(file);
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            let quality = 0.78;
            let scale = 1;
            const targetBytes = targetKB * 1024;
            if (file.size > targetBytes * 3) scale = 0.6;
            else if (file.size > targetBytes) scale = 0.8;
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => resolve(blob && blob.size < file.size ? new File([blob], file.name, { type: "image/jpeg" }) : file),
                "image/jpeg",
                quality
            );
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

const VULGAR_WORDS = ["offensive", "vulgar", "badword1", "badword2"];

const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MediaUploadPopup = ({ onClose, onFilesSelected, showToast }) => {
    const fileInputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    const validate = (files) => {
        const valid = [];
        const errors = [];
        for (const file of files) {
            const isImage = isImageFile(file);
            const isVideo = isVideoFile(file);
            const isDoc = ACCEPTED_RAW.includes(file.type) || (file.name.match(/\.(pdf|doc|docx|zip|rar|txt)$/i));

            if (!isImage && !isVideo && !isDoc) {
                errors.push(`${file.name}: unsupported format`);
                continue;
            }

            let limit = 10 * 1024 * 1024; // Default 10MB
            if (isImage) limit = 10 * 1024 * 1024;
            if (isVideo) limit = 50 * 1024 * 1024;

            if (file.size > limit) {
                const limitText = isImage ? "10 MB" : isVideo ? "50 MB" : "10 MB";
                errors.push(`${file.name}: exceeds ${limitText} limit`);
                continue;
            }
            valid.push(file);
        }
        return { valid, errors };
    };

    const handleFiles = (files) => {
        const list = Array.from(files).slice(0, MAX_FILES);
        const { valid, errors } = validate(list);
        if (errors.length) showToast(errors[0]);
        if (valid.length) onFilesSelected(valid);
        if (valid.length || !errors.length) onClose();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    return createPortal(
        <div className="modal-overlay moments-aura-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div
                className="moments-aura-content media-upload-popup-v2"
                onClick={(e) => e.stopPropagation()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{ width: "400px", maxWidth: "95%", padding: 0 }}
            >
                <div className="moments-aura-header">
                    <h2 className="moments-aura-title">Media Upload</h2>
                    <button className="aura-close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div style={{ padding: '0 28px 28px' }}>
                    <p className="media-upload-hint" style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                        Images (max 10MB) &bull; Videos (max 18MB) &bull; Documents & Archives (max 10MB)
                    </p>

                    <div
                        className={`media-upload-dropzone ${dragOver ? "dragover" : ""}`}
                        onClick={() => fileInputRef.current?.click()}
                        style={{ border: '2px dashed var(--color-border, rgba(255, 255, 255, 0.08))', borderRadius: '20px', padding: '40px 20px', transition: 'all 0.2s' }}
                    >
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 16 }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Tap to browse or drop here</span>
                        <span className="media-upload-sub" style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>Select up to {MAX_FILES} files</span>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.mpeg,.avi,.pdf,.doc,.docx,.zip,.rar,.txt"
                    style={{ display: "none" }}
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>
        </div>,
        document.body
    );
};

const MediaPreview = ({ files, onRemove, onToggleQuality }) => {
    if (!files.length) return null;

    const getStagedFileSizeText = (file, isHD) => {
        const isImage = isImageFile(file);
        let size = file.size;
        if (isImage && !isHD) {
            size = Math.round(size * 0.78);
        }
        return formatFileSize(size);
    };

    return (
        <div className="media-preview-strip">
            {files.map((item, i) => {
                const { file, isHD } = item;
                const isImg = isImageFile(file);
                const isVid = isVideoFile(file);
                const isMedia = isImg || isVid;
                const url = URL.createObjectURL(file);
                return (
                    <div 
                        key={i} 
                        className="media-preview-item"
                        style={{ position: 'relative', cursor: isMedia ? 'pointer' : 'default' }}
                        onDoubleClick={() => {
                            if (isMedia) onToggleQuality(i);
                        }}
                    >
                        {isVid ? (
                            <video src={url} className="media-preview-thumb" muted />
                        ) : isImg ? (
                            <img src={url} alt={file.name} className="media-preview-thumb" />
                        ) : (
                            <div className="media-preview-thumb" style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'var(--color-overlay, rgba(255, 255, 255, 0.04))',
                                gap: '2px',
                                padding: '4px',
                                textAlign: 'center',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)', opacity: 0.85 }}>
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span style={{
                                    fontSize: '8px',
                                    fontWeight: '800',
                                    color: '#f1f5f9',
                                    textTransform: 'uppercase',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100%',
                                    letterSpacing: '0.2px'
                                }}>{file.name.split('.').pop() || 'FILE'}</span>
                            </div>
                        )}
                        <span className="media-preview-name">{getStagedFileSizeText(file, isHD)}</span>
                        
                        {isMedia && isHD && (
                            <div className="media-hd-badge" style={{
                                position: 'absolute',
                                top: '4px',
                                left: '4px',
                                background: "var(--color-surface, rgba(15, 23, 42, 0.75))",
                                backdropFilter: 'blur(4px)',
                                color: 'var(--color-primary)',
                                fontSize: '8px',
                                fontWeight: '900',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                border: '1px solid rgba(61, 165, 217, 0.3)',
                                pointerEvents: 'none',
                                letterSpacing: '0.5px'
                            }}>OG</div>
                        )}
                        
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

const MessageInput = ({ chatId, editingMessage, replyingTo, onCancelEdit, onCancelReply, disabled = false, disabledPlaceholder = "Sending disabled..." }) => {
    const [content, setContent] = useState("");
    const [acModel, setAcModel] = useState(null);
    const [suggestion, setSuggestion] = useState('');
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showMediaPopup, setShowMediaPopup] = useState(false);
    const [stagedFiles, setStagedFiles] = useState([]);
    const [toast, setToast] = useState(null);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [gifPreviewUrl, setGifPreviewUrl] = useState("");
    const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    // True while VoiceRecorder is in recording or preview mode — hides the text input row
    const [voiceActive, setVoiceActive] = useState(false);
    const [isAnimatingSend, setIsAnimatingSend] = useState(false);
    const [sendCount, setSendCount] = useState(0);
    const { sendMessage, startTyping, stopTyping, editMessage, socket } = useSocket();

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };
    const addMessage = useChatStore((s) => s.addMessage);
    const updateMessage = useChatStore((s) => s.updateMessage);
    const userId = useAuthStore((s) => s.user?._id);
    const soundEnabled = useAuthStore((s) => s.soundEnabled);
    const activeChat = useChatStore((s) => s.activeChat);
    const allChats = useChatStore((s) => s.chats);
    const messages = activeChat?._id === chatId ? activeChat.messages : (allChats.find(c => c._id === chatId)?.messages || []);
    const isSendingMedia = messages?.some(m => m.senderId === userId && m.status === 'sending' && ['image', 'video', 'file', 'voice'].includes(m.type));
    
    const textareaRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);
    const contentRef = useRef(content);
    const editingRef = useRef(editingMessage);
    const touchStartRef = useRef(null);

    useEffect(() => {
        contentRef.current = content;
        editingRef.current = editingMessage;
    }, [content, editingMessage]);

    useEffect(() => {
        loadModel().then(setAcModel);
    }, []);

    useEffect(() => {
        if (!editingRef.current) {
            const draft = localStorage.getItem(`zc_draft_${chatId}`);
            setContent(draft || "");
        }
        
        // Smart Start check on new chat
        const checkSmartStart = () => {
            if (editingRef.current || contentRef.current) return;
            const activeChat = useChatStore.getState().activeChat;
            if (activeChat && activeChat.messages && activeChat.messages.length > 0) {
                const msgs = activeChat.messages.filter(m => !m.deletedForEveryone);
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.type === 'text' && lastMsg.senderId !== userId && lastMsg.senderId?._id !== userId) {
                    const smartReply = getSmartStart(lastMsg.content);
                    if (smartReply) setSuggestion(smartReply);
                }
            }
        };
        setTimeout(checkSmartStart, 300);

        return () => {
            if (!editingRef.current) {
                const currentText = contentRef.current || '';
                const key = `zc_draft_${chatId}`;
                if (currentText.trim()) {
                    localStorage.setItem(key, currentText);
                } else {
                    localStorage.removeItem(key);
                }
            }
            setSuggestion('');
        };
    }, [chatId, userId]);

    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = setTimeout(async () => {
            if (!content.trim()) {
                setGifPreviewUrl("");
                return;
            }
            try {
                const res = await axios.get("https://api.giphy.com/v1/gifs/search", {
                    params: {
                        api_key: (import.meta.env.VITE_GIPHY_API_KEY || "").trim() || "pnshJZOMgBP3OVpZzo4TCXPf99zhNIQA",
                        q: content.trim(),
                        limit: 1,
                        rating: "g"
                    },
                    signal: controller.signal
                });
                if (res.data?.data?.length > 0) {
                    setGifPreviewUrl(res.data.data[0].images.fixed_height_small.url);
                } else {
                    setGifPreviewUrl("");
                }
            } catch (err) {
                if (!axios.isCancel(err)) {
                    setGifPreviewUrl("");
                }
            }
        }, 500);
        return () => { clearTimeout(timeoutId); controller.abort(); };
    }, [content]);

    const handleGifSelect = (url, type) => {
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const activeChat = useChatStore.getState().activeChat;
        const isZen = useChatStore.getState().isZenMode;
        
        addMessage(chatId, {
            _id: tempId,
            cid: tempId,
            chatId,
            senderId: userId,
            content: "",
            type: type,
            mediaUrl: url,
            status: "sending",
            createdAt: new Date().toISOString(),
            disappearingMode: activeChat?.disappearingMode || "off",
            isZenMessage: isZen
        });
        
        sendMessage(chatId, "", type, url, replyingTo?._id, false, tempId, isZen);
        if (soundEnabled) playSendSound();
        setShowGifPicker(false);
        onCancelReply();
        // Do NOT clear content
    };

    const adjustHeight = () => {
        const el = textareaRef.current;
        if (!el) return;
        if (!content) {
            el.style.height = "36px";
            return;
        }
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    useEffect(() => { adjustHeight(); }, [content, stagedFiles]);

    useEffect(() => {
        if (editingMessage) {
            setContent(editingMessage.content);
            textareaRef.current?.focus();
        } else {
            setContent("");
        }
    }, [editingMessage]);

    const getScramble = (text) => {
        if (!text) return "";
        const leetMap = {
            'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7', 'b': '8', 'g': '6'
        };
        const chars = "░▒▓█";

        const segment = text.toLowerCase().slice(-10);
        let result = "";

        for (let i = 0; i < segment.length; i++) {
            const char = segment[i];
            if (leetMap[char] && Math.random() > 0.1) {
                result += leetMap[char];
            } else if (char === " ") {
                result += "_";
            } else if (Math.random() > 0.5) {
                const symbols = "01<>/_";
                result += symbols.charAt(Math.floor(Math.random() * symbols.length));
            } else {
                result += char;
            }
        }
        return result || "...";
    };

    const handleTypingStart = useCallback((currentText) => {
        const isLowBandwidth = useChatStore.getState().isLowBandwidth;
        const scramble = isLowBandwidth ? "" : getScramble(currentText);
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            startTyping(chatId, scramble);
        } else if (!isLowBandwidth) {
            startTyping(chatId, scramble);
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
        const val = e.target.value;
        setContent(val);
        if (!editingMessage) handleTypingStart(val);
        
        // Autocomplete
        if (acModel && !editingMessage) {
            if (!val.trim()) {
                setSuggestion('');
                return;
            }
            const words = val.split(/\s+/);
            const lastWord = words[words.length - 1];
            const endsWithSpace = val.endsWith(' ');
            
            if (endsWithSpace && words.length >= 2) {
                const prev = words[words.length - 2];
                setSuggestion(getNextWordSuggestion(prev, acModel) || '');
            } else if (lastWord.length >= 3) {
                const fullWord = getWordSuggestion(lastWord, acModel);
                // Store only the suffix (remaining letters), not the full word
                setSuggestion(fullWord ? fullWord.substring(lastWord.length) : '');
            } else {
                setSuggestion('');
            }
        }
    };

    const filterOffensive = (text) => {
        let filtered = text;
        VULGAR_WORDS.forEach(word => {
            filtered = filtered.replace(new RegExp(word, "gi"), "****");
        });
        return filtered;
    };

    const uploadAndSend = async (files, textContent, replyToId, isViewOnceVal) => {
        setUploading(true);
        try {
            const cloudName = "du4nvei7j";
            const uploadPreset = "ml_default";

            for (const item of files) {
                const { file, isHD } = item;
                const isVideo = isVideoFile(file);
                const isImage = isImageFile(file);
                const isDoc = !isImage && !isVideo;
                const msgType = isVideo ? "video" : isImage ? "image" : "file";
                const uploadType = isVideo ? "video" : isImage ? "image" : "raw";

                const tempId = `temp-${Date.now()}-${Math.random()}`;

                const activeChat = useChatStore.getState().activeChat;
                const isZen = useChatStore.getState().isZenMode;
                const isLowBandwidth = useChatStore.getState().isLowBandwidth;
                const msgContent = files.length === 1 ? (textContent || (isDoc ? file.name : "")) : (isDoc ? file.name : "");
                const lqip = isImage ? await generateLQIP(file) : "";

                addMessage(chatId, {
                    _id: tempId,
                    cid: tempId,
                    chatId,
                    senderId: userId,
                    content: msgContent,
                    type: msgType,
                    mediaUrl: URL.createObjectURL(file),
                    status: "sending",
                    progress: 0,
                    replyTo: replyToId,
                    createdAt: new Date().toISOString(),
                    disappearingMode: activeChat?.disappearingMode || "off",
                    isZenMessage: isZen,
                    lqip
                });

                let fileToUpload = file;
                if (isImage && !isHD) {
                    fileToUpload = await compressImage(file, isLowBandwidth ? 150 : 300);
                }

                const formData = new FormData();
                formData.append("file", fileToUpload);
                formData.append("upload_preset", uploadPreset);

                try {
                    const res = await axios.post(
                        `https://api.cloudinary.com/v1_1/${cloudName}/${uploadType}/upload`,
                        formData,
                        {
                            onUploadProgress: (p) => {
                                const percent = Math.round((p.loaded * 100) / p.total);
                                updateMessage(chatId, { _id: tempId, progress: percent });
                            }
                        }
                    );
                    const downloadURL = res.data.secure_url;
                    const isZenMessage = useChatStore.getState().isZenMode;
                    sendMessage(chatId, msgContent, msgType, downloadURL, replyToId, isViewOnceVal, tempId, isZenMessage, "", null, "", lqip);
                } catch (uploadErr) {
                    console.warn("[MessageInput] Upload failed, queuing for retry:", uploadErr?.message);
                    updateMessage(chatId, { _id: tempId, status: "pending" });
                    // Persist as base64 for retry on reconnect
                    try {
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                            const base64 = e.target.result.split(",")[1];
                            await enqueuePendingMedia({
                                base64,
                                fileName: fileToUpload.name,
                                fileType: fileToUpload.type,
                                uploadType,
                                chatId,
                                textContent: msgContent,
                                replyTo: replyToId,
                                isViewOnce: isViewOnceVal,
                                cid: tempId,
                                isZenMessage: isZen,
                                isLowBandwidth,
                                lqip
                            });
                        };
                        reader.readAsDataURL(fileToUpload);
                    } catch (qErr) {
                        console.error("[MessageInput] Failed to queue media for retry:", qErr);
                    }
                }
            }
            if (soundEnabled) playSendSound();
        } catch (error) {
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const formatDuration = (secs) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const uploadAndSendVoice = async (blob, durationSecs, waveformBase64) => {
        if (!blob) return;
        setIsVoiceMode(false);
        setUploading(true);

        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const activeChat = useChatStore.getState().activeChat;
        const isZen = useChatStore.getState().isZenMode;
        const durationStr = formatDuration(durationSecs);

        addMessage(chatId, {
            _id: tempId,
            cid: tempId,
            chatId,
            senderId: userId,
            content: durationStr,
            type: "voice",
            mediaUrl: URL.createObjectURL(blob),
            waveform: waveformBase64,
            status: "sending",
            replyTo: replyingTo?._id || null,
            createdAt: new Date().toISOString(),
            disappearingMode: activeChat?.disappearingMode || "off",
            isZenMessage: isZen
        });

        let extension = "webm";
        if (blob.type.includes("mp4")) {
            extension = "mp4";
        } else if (blob.type.includes("ogg")) {
            extension = "ogg";
        } else if (blob.type.includes("wav")) {
            extension = "wav";
        } else if (blob.type.includes("aac") || blob.type.includes("m4a")) {
            extension = "m4a";
        }
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "ml_default");

        try {
            const res = await axios.post(
                "https://api.cloudinary.com/v1_1/du4nvei7j/video/upload",
                formData
            );
            const downloadURL = res.data.secure_url;
            const isZenMessage = useChatStore.getState().isZenMode;
            sendMessage(chatId, durationStr, "voice", downloadURL, replyingTo?._id, false, tempId, isZenMessage, waveformBase64);
        } catch (uploadErr) {
            console.warn("[MessageInput] Voice upload failed, queuing for retry:", uploadErr?.message);
            updateMessage(chatId, { _id: tempId, status: "pending" });
            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target.result.split(",")[1];
                    await enqueuePendingMedia({
                        base64,
                        fileName: file.name,
                        fileType: file.type,
                        uploadType: "video",
                        msgType: "voice",
                        waveform: waveformBase64,
                        chatId,
                        textContent: durationStr,
                        replyTo: replyingTo?._id,
                        isViewOnce: false,
                        cid: tempId,
                        isZenMessage: isZen,
                        isLowBandwidth: false
                    });
                };
                reader.readAsDataURL(file);
            } catch (qErr) {
                console.error("[MessageInput] Failed to queue voice for retry:", qErr);
            }
        } finally {
            setUploading(false);
            if (soundEnabled) playSendSound();
            onCancelReply();
        }
    };

    const handleSend = async () => {
        const filteredContent = filterOffensive(content.trim());

        if (stagedFiles.length > 0) {
            const filesToUpload = [...stagedFiles];
            const replyToId = replyingTo?._id;
            const isViewOnceVal = isViewOnce;
            setContent("");
            localStorage.removeItem(`zc_draft_${chatId}`);
            setSuggestion('');
            if (filteredContent) trainOnMessage(filteredContent).then(loadModel).then(setAcModel);
            setStagedFiles([]);
            setIsViewOnce(false);
            onCancelReply();
            clearTyping();
            
            setIsAnimatingSend(true);
            setSendCount(prev => prev + 1);
            setTimeout(() => {
                setIsAnimatingSend(false);
            }, 550);

            uploadAndSend(filesToUpload, filteredContent, replyToId, isViewOnceVal);
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
            const tempId = `temp-${Date.now()}-${Math.random()}`;
            const activeChat = useChatStore.getState().activeChat;
            const isZen = useChatStore.getState().isZenMode;
            
            setIsAnimatingSend(true);
            setSendCount(prev => prev + 1);
            setTimeout(() => {
                setIsAnimatingSend(false);
            }, 550);

            addMessage(chatId, {
                _id: tempId,
                cid: tempId,
                chatId,
                senderId: userId,
                content: filteredContent,
                type: "text",
                status: "sending",
                createdAt: new Date().toISOString(),
                disappearingMode: activeChat?.disappearingMode || "off",
                isZenMessage: isZen
            });
            sendMessage(chatId, filteredContent, "text", "", replyingTo?._id, false, tempId, isZen);
            if (soundEnabled) playSendSound();
            onCancelReply();
            if (filteredContent) trainOnMessage(filteredContent).then(loadModel).then(setAcModel);
        }

        setContent("");
        localStorage.removeItem(`zc_draft_${chatId}`);
        setSuggestion('');
        setIsViewOnce(false);
        clearTyping();
        textareaRef.current?.focus();
    };

    const clearTyping = () => {
        clearTimeout(typingTimeoutRef.current);
        isTypingRef.current = false;
        stopTyping(chatId);
    };

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const files = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/") || items[i].type.startsWith("video/")) {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }

        if (files.length > 0) {
            e.preventDefault();
            handleFilesSelected(files);
        }
    };

    const handleKeyDown = (e) => {
        if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion) {
            e.preventDefault();
            const endsWithSpace = content.endsWith(' ');
            const words = content.split(/\s+/);
            if (endsWithSpace) {
                // next-word suggestion: append the full suggested word
                setContent(content + suggestion + ' ');
            } else {
                // word-completion suggestion: append the suffix to current partial word
                setContent(content + suggestion + ' ');
            }
            setSuggestion('');
            return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        if (e.key === "Escape") {
            if (editingMessage) onCancelEdit();
            if (suggestion) setSuggestion('');
        }
    };

    const getFileCategory = (file) => {
        const type = file.type;
        const name = file.name.toLowerCase();
        const isImage = isImageFile(file);
        const isVideo = isVideoFile(file);
        if (isImage || isVideo) return "media";
        const isZip = type === "application/zip" || 
                      type === "application/x-zip-compressed" || 
                      type === "application/x-rar-compressed" || 
                      name.endsWith(".zip") || 
                      name.endsWith(".rar");
        if (isZip) return "zip";
        return "doc";
    };

    const handleFilesSelected = (files) => {
        if (!files || files.length === 0) return;

        const firstCategory = getFileCategory(files[0]);
        for (let i = 1; i < files.length; i++) {
            if (getFileCategory(files[i]) !== firstCategory) {
                showToast("Cannot mix media, documents, or archives in one message");
                return;
            }
        }

        if (stagedFiles.length > 0) {
            const currentCategory = getFileCategory(stagedFiles[0].file);
            if (firstCategory !== currentCategory) {
                showToast("Cannot mix media, documents, or archives in one message");
                return;
            }
        }

        const mapped = files.map(f => ({ file: f, isHD: false }));
        setStagedFiles(prev => {
            const combined = [...prev, ...mapped];
            const sliced = combined.slice(0, MAX_FILES);
            const finalMediaCount = sliced.filter(item => getFileCategory(item.file) === "media").length;
            const finalDocCount = sliced.filter(item => getFileCategory(item.file) !== "media").length;
            if (finalMediaCount !== 1 || finalDocCount > 0) {
                setIsViewOnce(false);
            }
            return sliced;
        });
    };

    const removeFile = (index) => {
        setStagedFiles(prev => {
            const filtered = prev.filter((_, i) => i !== index);
            const mediaCount = filtered.filter(item => getFileCategory(item.file) === "media").length;
            const docCount = filtered.filter(item => getFileCategory(item.file) !== "media").length;
            if (mediaCount !== 1 || docCount > 0) {
                setIsViewOnce(false);
            }
            return filtered;
        });
    };

    const toggleFileQuality = (index) => {
        setStagedFiles(prev => prev.map((item, i) => {
            if (i === index) {
                const nextHD = !item.isHD;
                showToast(nextHD ? "Original quality enabled for this media" : "Standard quality enabled for this media");
                return { ...item, isHD: nextHD };
            }
            return item;
        }));
    };

    const hasMedia = stagedFiles.length > 0;
    const showViewOnceBtn = stagedFiles.length === 1 && getFileCategory(stagedFiles[0].file) === "media";
    const sendDisabled = disabled || uploading || (!content.trim() && !hasMedia) || (isViewOnce && !hasMedia);

    return (
        <div className="message-input-wrap">
            {toast && <div className="zen-toast zen-toast-info" style={{ pointerEvents: 'none' }}>{toast}</div>}
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
                            Replying to {(() => {
                                if (replyingTo.senderId === userId || replyingTo.senderId?._id === userId) return "yourself";
                                const sender = replyingTo.senderId;
                                if (typeof sender === 'object' && sender?.username) return sender.username;
                                const activeChat = useChatStore.getState().activeChat;
                                const other = activeChat?.participants?.find(p => (p._id || p) === (sender?._id || sender));
                                return other?.username || "them";
                            })()}
                        </div>
                        <div className="reply-to-text">
                            {replyingTo.type === "image" ? "Image" :
                                replyingTo.type === "video" ? "Video" :
                                    replyingTo.type === "voice" ? "Voice message" :
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
                <MediaPreview files={stagedFiles} onRemove={removeFile} onToggleQuality={toggleFileQuality} />
            )}

            <div className="message-input-box">
                {!voiceActive && (<>
                <button
                    className="attachment-btn"
                    onClick={() => {
                        if (window.innerWidth <= 768) {
                            setShowAttachmentSheet(true);
                        } else {
                            setShowMediaPopup(true);
                        }
                    }}
                    disabled={disabled || uploading || stagedFiles.length >= MAX_FILES || isSendingMedia}
                    title="Attach media"
                    style={{ opacity: (disabled || isSendingMedia) ? 0.5 : 1, flexShrink: 0 }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    {hasMedia && <span className="attachment-badge">{stagedFiles.length}</span>}
                </button>

                <button
                    className="gif-preview-btn"
                    onClick={() => setShowGifPicker(true)}
                    disabled={disabled || uploading}
                    title="Search GIFs and Stickers"
                >
                    {gifPreviewUrl ? (
                        <img src={gifPreviewUrl} alt="GIF preview" className="gif-preview-img" />
                    ) : (
                        <span>GIF</span>
                    )}
                </button>
                </>)}

                {!voiceActive && showViewOnceBtn && (
                    <button
                        className={`view-once-btn ${isViewOnce ? "active" : ""}`}
                        onClick={() => setIsViewOnce(!isViewOnce)}
                        disabled={disabled || uploading}
                        title={isViewOnce ? "View-Once ON - for uploaded media" : "Enable View-Once for media"}
                        style={{ opacity: disabled ? 0.5 : 1 }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                )}

                {!voiceActive && <div 
                    style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, minHeight: '36px' }}
                    onTouchStart={(e) => {
                        if (suggestion) touchStartRef.current = e.touches[0].clientX;
                    }}
                    onTouchEnd={(e) => {
                        if (!suggestion || touchStartRef.current === null) return;
                        const endX = e.changedTouches[0].clientX;
                        if (endX - touchStartRef.current > 40) { // Swipe right to accept
                            const endsWithSpace = content.endsWith(' ');
                            if (endsWithSpace) {
                                // next-word: append whole suggested word
                                setContent(content + suggestion + ' ');
                            } else {
                                // word-completion: append suffix to current partial
                                setContent(content + suggestion + ' ');
                            }
                            setSuggestion('');
                        }
                        touchStartRef.current = null;
                    }}
                >
                    {suggestion && !disabled && (
                        <div
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                padding: '8px 0',
                                fontSize: 'var(--text-sm)',
                                lineHeight: '1.4',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: 'transparent',
                                pointerEvents: 'none',
                                zIndex: 1,
                                width: '100%',
                                fontFamily: 'inherit'
                            }}
                        >
                            {content}<span style={{ color: '#94a3b8', opacity: 0.6 }}>{suggestion}</span>
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        className="message-textarea"
                        placeholder={
                            disabled ? disabledPlaceholder :
                                uploading ? "Uploading..." :
                                    hasMedia ? "Add a caption..." :
                                        isViewOnce ? "Upload a file to send view-once media..." :
                                            editingMessage ? "Edit your message..." :
                                                "Type a message..."
                        }
                        value={content}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onFocus={() => {
                            if (window.innerWidth <= 768) {
                                setTimeout(() => {
                                    window.dispatchEvent(new Event("keyboard-open"));
                                }, 300);
                            }
                        }}
                        disabled={disabled || uploading || (isViewOnce && !hasMedia)}
                        rows={1}
                        aria-label="Message input"
                        style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'text' }}
                    />
                </div>}

                {!voiceActive && (content.trim() || hasMedia || editingMessage || isAnimatingSend) && (
                <button
                    className={`send-btn ${!sendDisabled ? "send-btn-active" : ""} ${isAnimatingSend ? "is-animating" : ""}`}
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
                        <svg key={sendCount} className="send-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    )}
                </button>
                )}

                {/* Mic button / recorder — visible only when no text typed and no files staged and not editing */}
                {!content.trim() && !hasMedia && !editingMessage && !disabled && (
                    <VoiceRecorder
                        key={chatId}
                        chatId={chatId}
                        isMobile={window.innerWidth <= 768}
                        onSend={uploadAndSendVoice}
                        onCancel={() => { setIsVoiceMode(false); setVoiceActive(false); }}
                        onModeChange={(m) => {
                            const active = m !== "idle";
                            setVoiceActive(active);
                            setIsVoiceMode(active);
                            if (m === "recording") {
                                socket?.emit?.("voice_recording_start", { chatId });
                            } else {
                                socket?.emit?.("voice_recording_stop", { chatId });
                            }
                        }}
                    />
                )}
            </div>

            <div className="input-hint-row">
                <span className="input-hint desktop-only">
                    Enter to send · Shift+Enter for new line{!content.trim() && !hasMedia ? " · Space: hold to record" : ""}
                    {editingMessage ? " · Esc to cancel" : ""}
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!editingMessage && content.trim() && localStorage.getItem(`zc_draft_${chatId}`) && (
                        <span className="input-hint" style={{ color: '#eab308', fontWeight: 600 }}>Draft</span>
                    )}
                    {isViewOnce && (
                        <span className="input-hint">View Once active</span>
                    )}
                    {stagedFiles.some(f => isImageFile(f.file)) && (
                        <span className="input-hint">
                            Double-tap image to toggle OG
                        </span>
                    )}
                </div>
            </div>

            {showMediaPopup && (
                <MediaUploadPopup
                    onClose={() => setShowMediaPopup(false)}
                    onFilesSelected={handleFilesSelected}
                    showToast={showToast}
                />
            )}
            
            {showGifPicker && (
                <GifPicker
                    onClose={() => setShowGifPicker(false)}
                    onSelect={handleGifSelect}
                    initialQuery={content.trim()}
                />
            )}

            {showAttachmentSheet && createPortal(
                <div className="modal-overlay" onClick={() => setShowAttachmentSheet(false)} style={{ zIndex: 10002, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div className="attachment-sheet" onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', width: '100%', maxWidth: '500px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <label className="attachment-option" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', background: 'var(--color-overlay, rgba(255, 255, 255, 0.05))', cursor: 'pointer' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--color-text, #f1f5f9)' }}>Gallery</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #94a3b8)' }}>Photos and Videos</div>
                            </div>
                            <input 
                                type="file" 
                                accept="image/*,video/*" 
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    setShowAttachmentSheet(false);
                                    handleFilesSelected(Array.from(e.target.files));
                                    e.target.value = null;
                                }}
                            />
                        </label>
                        
                        <label className="attachment-option" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', background: 'var(--color-overlay, rgba(255, 255, 255, 0.05))', cursor: 'pointer' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--color-text, #f1f5f9)' }}>Document</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #94a3b8)' }}>Files and Archives</div>
                            </div>
                            <input 
                                type="file" 
                                accept="*" 
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    setShowAttachmentSheet(false);
                                    handleFilesSelected(Array.from(e.target.files));
                                    e.target.value = null;
                                }}
                            />
                        </label>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MessageInput;