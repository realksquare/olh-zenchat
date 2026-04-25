import { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import MusicSearch from "./MusicSearch";

const MomentCreator = ({ isOpen, onClose }) => {
    const [content, setContent] = useState("");
    const [media, setMedia] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [music, setMusic] = useState(null);
    const [isMusicSearchOpen, setIsMusicSearchOpen] = useState(false);
    const [duration, setDuration] = useState(18);
    const [startTime, setStartTime] = useState(0);
    const [toast, setToast] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const audioRef = useRef(null);
    const { createMoment } = useMomentStore();

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 5000); // 5 seconds for success/fail
    };

    // Live Audio Preview Logic (Instagram Style)
    useEffect(() => {
        if (isOpen && music && music.previewUrl) {
            if (!audioRef.current) {
                audioRef.current = new Audio(music.previewUrl);
                audioRef.current.loop = true;
            } else if (audioRef.current.src !== music.previewUrl) {
                audioRef.current.src = music.previewUrl;
            }

            audioRef.current.currentTime = startTime;
            audioRef.current.play().catch(e => console.log("Auto-play blocked"));

            // Loop within the duration window
            const checkTime = () => {
                if (audioRef.current && audioRef.current.currentTime >= startTime + duration) {
                    audioRef.current.currentTime = startTime;
                }
            };
            const interval = setInterval(checkTime, 100);
            return () => {
                clearInterval(interval);
                if (audioRef.current) audioRef.current.pause();
            };
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        }
    }, [music, startTime, duration, isOpen]);

    // Ensure startTime is valid when duration changes
    useEffect(() => {
        const maxStart = Math.max(0, 30 - duration);
        if (startTime > maxStart) setStartTime(0);
    }, [duration]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setMedia(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result);
        reader.readAsDataURL(file);
    };

    const handleShare = async () => {
        if (!content && !media && !music) return;

        setIsUploading(true);
        try {
            let mediaUrl = "";
            let type = "text";

            if (media) {
                const formData = new FormData();
                formData.append("file", media);
                formData.append("upload_preset", "zenchat_unsigned");
                
                const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`, {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                mediaUrl = data.secure_url;
                type = data.resource_type === "video" ? "video" : "image";
            } else if (music) {
                type = "music";
            }

            await createMoment({
                type,
                content,
                mediaUrl,
                music: music ? { ...music, duration, startTime } : null
            });

            showToast("Moment exhaled successfully. ✨");
            
            setTimeout(() => {
                onClose();
                setContent("");
                setMedia(null);
                setPreviewUrl(null);
                setMusic(null);
                setIsMusicSearchOpen(false);
            }, 1500);
        } catch (err) {
            showToast("Breath lost... try again. 🌪️");
            console.error("Failed to share moment:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="modal-overlay moments-aura-overlay" onClick={handleClose}>
                <div className="moments-aura-content" onClick={(e) => e.stopPropagation()}>
                    <div className="moments-aura-header">
                        <h2 className="moments-aura-title">#Moments.</h2>
                        <button className="aura-close-btn" onClick={handleClose}>
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
                                <p>Add Media (optional) - images (max 3mb), videos (max 7mb)</p>
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
                            <>
                                <div className="aura-music-card">
                                    <div className="music-icon pulse">
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
                                <div className="aura-music-cropper">
                                    <div className="cropper-label">
                                        <span>Zen-Cropper: {startTime}s - {startTime + duration}s</span>
                                        <div className="aura-duration-selector">
                                            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                                                <option value={18}>18s</option>
                                                <option value={24}>24s</option>
                                                <option value={30}>30s</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="cropper-track-wrapper">
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max={30 - duration} 
                                            step="0.5"
                                            value={startTime} 
                                            onChange={(e) => setStartTime(Number(e.target.value))}
                                            className="aura-slider"
                                        />
                                        <div className="cropper-window-preview" style={{ 
                                            left: `${(startTime / 30) * 100}%`,
                                            width: `${(duration / 30) * 100}%`
                                        }} />
                                    </div>
                                </div>
                            </>
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
                                {!media && !music && (
                                    <button className="aura-tool-btn" title="Capture Breath" onClick={() => fileInputRef.current?.click()}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            <button 
                                className="aura-share-btn" 
                                onClick={handleShare}
                                disabled={isUploading || (!content && !media && !music)}
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
            </div>
            {toast && (
                <div className="aura-toast">
                    {toast.includes("success") ? "✨" : "🌪️"}
                    {toast}
                </div>
            )}
        </>,
        document.body
    );
};

export default memo(MomentCreator);
