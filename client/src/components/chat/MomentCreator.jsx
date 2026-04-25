import { useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import axiosInstance from "../../utils/axios";
import MusicSearch from "./MusicSearch";

const MomentCreator = ({ isOpen, onClose }) => {
    const [content, setContent] = useState("");
    const [media, setMedia] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [music, setMusic] = useState(null);
    const [isMusicSearchOpen, setIsMusicSearchOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const { createMoment } = useMomentStore();

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setMedia(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result);
        reader.readAsDataURL(file);
    };

    const handleShare = async () => {
        if (!content && !media) return;

        setIsUploading(true);
        try {
            let mediaUrl = "";
            let type = "text";

            if (media) {
                const formData = new FormData();
                formData.append("file", media);
                formData.append("upload_preset", "zenchat_unsigned"); // Ensure you have this preset in Cloudinary
                
                // Using standard fetch for Cloudinary to avoid axios instance interceptors
                const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`, {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                mediaUrl = data.secure_url;
                type = data.resource_type === "video" ? "video" : "image";
            }

            await createMoment({
                type: music && !media ? "music" : type,
                content,
                mediaUrl,
                music
            });

            onClose();
            setContent("");
            setMedia(null);
            setPreviewUrl(null);
            setMusic(null);
            setIsMusicSearchOpen(false);
        } catch (err) {
            console.error("Failed to share moment:", err);
        } finally {
            setIsUploading(false);
        }
    };

    return createPortal(
        <div className="modal-overlay moments-aura-overlay" onClick={onClose}>
            <div className="moments-aura-content" onClick={(e) => e.stopPropagation()}>
                <div className="moments-aura-header">
                    <h2 className="moments-aura-title">#Moments.</h2>
                    <button className="aura-close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="aura-preview-container">
                    {previewUrl ? (
                        <div className="aura-media-wrapper">
                            {media?.type.startsWith("video") ? (
                                <video src={previewUrl} autoPlay muted loop className="aura-media" />
                            ) : (
                                <img src={previewUrl} alt="Preview" className="aura-media" />
                            )}
                            <button className="aura-remove-media" onClick={() => { setMedia(null); setPreviewUrl(null); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="aura-placeholder" onClick={() => fileInputRef.current?.click()}>
                            <div className="aura-placeholder-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                            </div>
                            <p>Tap to capture a breath...</p>
                            <span>Images or Videos</span>
                        </div>
                    )}
                </div>

                <div className="aura-input-section">
                    <textarea 
                        className="aura-textarea"
                        placeholder="What's your current vibe?"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        maxLength={150}
                    />

                    {music && (
                        <div className="aura-music-card">
                            <div className="music-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                            </div>
                            <div className="music-details">
                                <span className="music-title">{music.title}</span>
                                <span className="music-artist">{music.artist}</span>
                            </div>
                            <button className="remove-music" onClick={() => setMusic(null)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {isMusicSearchOpen && (
                        <MusicSearch 
                            onSelect={(track) => {
                                setMusic(track);
                                setIsMusicSearchOpen(false);
                            }}
                            onClose={() => setIsMusicSearchOpen(false)}
                        />
                    )}
                    
                    <div className="aura-actions">
                        <div className="aura-tools">
                            <button className="aura-tool-btn" title="Add Media" onClick={() => fileInputRef.current?.click()}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </button>
                            <button className="aura-tool-btn" title="Add Music" onClick={() => setIsMusicSearchOpen(!isMusicSearchOpen)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                accept="image/*,video/*"
                                onChange={handleFileChange}
                            />
                        </div>

                        <button 
                            className="aura-share-btn" 
                            onClick={handleShare}
                            disabled={isUploading || (!content && !media)}
                        >
                            {isUploading ? (
                                <div className="aura-loader"></div>
                            ) : (
                                <>
                                    <span>Share One-Breath</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13" />
                                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentCreator);
