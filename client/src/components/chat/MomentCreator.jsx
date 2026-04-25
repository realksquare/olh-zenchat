import { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import MusicSearch from "./MusicSearch";

const MomentCreator = ({ isOpen, onClose }) => {
    const [content, setContent] = useState("");
    const [media, setMedia] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [music, setMusic] = useState(null);
    const [isMusicSearchOpen, setIsMusicSearchOpen] = useState(false);
    const [duration, setDuration] = useState(18);
    const [startTime, setStartTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [toast, setToast] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [cameraState, setCameraState] = useState("closed");
    const fileInputRef = useRef(null);
    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const seekTimeoutRef = useRef(null);
    const { createMoment, moments } = useMomentStore();
    const { user } = useAuthStore();

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 5000);
    };

    // Live Audio Preview Logic
    useEffect(() => {
        if (isOpen && music && music.previewUrl) {
            if (!audioRef.current) {
                audioRef.current = new Audio(music.previewUrl);
                audioRef.current.loop = true;
            } else if (audioRef.current.src !== music.previewUrl) {
                audioRef.current.src = music.previewUrl;
            }

            if (isPlaying) {
                if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
                seekTimeoutRef.current = setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.currentTime = startTime;
                        audioRef.current.play().catch(e => console.log("Audio blocked"));
                    }
                }, 150);
            } else {
                audioRef.current.pause();
            }

            const checkTime = () => {
                if (audioRef.current && isPlaying && audioRef.current.currentTime >= startTime + duration) {
                    audioRef.current.currentTime = startTime;
                }
            };
            const interval = setInterval(checkTime, 100);
            return () => {
                clearInterval(interval);
                if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
                if (audioRef.current) audioRef.current.pause();
            };
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        }
    }, [music, startTime, duration, isOpen, isPlaying]);

    const compressImage = (base64Str, maxSize = 3 * 1024 * 1024) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                if (width > 1600) { height *= 1600 / width; width = 1600; }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                let quality = 0.8;
                let result = canvas.toDataURL("image/jpeg", quality);
                while (result.length > maxSize && quality > 0.1) {
                    quality -= 0.1;
                    result = canvas.toDataURL("image/jpeg", quality);
                }
                fetch(result).then(res => res.blob()).then(blob => resolve({ blob, dataUrl: result }));
            };
        });
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            streamRef.current = stream;
            setCameraState("active");
            showToast("Camera breath granted. ✨");
        } catch (err) {
            setCameraState("closed");
            showToast("Camera breath denied. 🌪️");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraState("closed");
    };

    const handleCameraCapture = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(videoRef.current, 0, 0);
        const { blob, dataUrl } = await compressImage(canvas.toDataURL("image/jpeg"));
        if (!blob) { showToast("Compression failed. 🌪️"); return; }
        setMedia(new File([blob], "capture.jpg", { type: "image/jpeg" }));
        setPreviewUrl(dataUrl);
        stopCamera();
    };

    const handleShare = async () => {
        if (!content && !media && !music) return;
        const ownMomentsCount = moments.filter(m => (m.userId?._id || m.userId) === user?._id).length;
        if (ownMomentsCount >= 5) {
            showToast("Slow down... only 5 exhales per cycle allowed. 🌪️");
            return;
        }
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
            } else if (music) type = "music";
            await createMoment({ type, content, mediaUrl, music: music ? { ...music, duration, startTime } : null });
            showToast("Moment exhaled successfully. ✨");
            setTimeout(() => { 
                onClose(); 
                setContent(""); setMedia(null); setPreviewUrl(null); setMusic(null); setStartTime(0);
                setIsPlaying(true);
            }, 1500);
        } catch (err) {
            showToast("Breath lost... try again. 🌪️");
        } finally { setIsUploading(false); }
    };

    const handleClose = () => {
        stopCamera();
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
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
                        {cameraState === "active" ? (
                            <div className="aura-camera-view">
                                <video ref={videoRef} autoPlay playsInline className="aura-media" />
                                <div className="camera-controls">
                                    <button className="camera-shutter" onClick={handleCameraCapture}></button>
                                    <button className="camera-cancel" onClick={stopCamera}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ) : previewUrl ? (
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
                                <div className="aura-placeholder-text">
                                    <p>Add Media (optional)</p>
                                    <span>Images (max 3mb), Videos (max 7mb)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="aura-input-section">
                        <textarea className="aura-textarea" placeholder="What's your current vibe?" value={content} onChange={(e) => setContent(e.target.value)} maxLength={150} />
                        
                        {music && (
                            <div className="aura-music-cropper">
                                <div className="cropper-label">
                                    <div className="label-with-play">
                                        <button className="cropper-play-btn" onClick={() => setIsPlaying(!isPlaying)}>
                                            {isPlaying ? (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                            )}
                                        </button>
                                        <span>{music.title} • {music.artist}</span>
                                    </div>
                                    <select value={duration} onChange={(e) => { 
                                        const newDur = Number(e.target.value);
                                        setDuration(newDur);
                                        if (startTime + newDur > 30) setStartTime(30 - newDur);
                                    }} className="aura-duration-select">
                                        <option value={18}>18s</option>
                                        <option value={24}>24s</option>
                                        <option value={30}>30s</option>
                                    </select>
                                    <button className="aura-remove-music" onClick={() => { setMusic(null); setIsPlaying(false); }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                </div>
                                <div className="cropper-track-wrapper">
                                    <div className="cropper-window-preview" style={{ 
                                        left: `${(startTime / 30) * 100}%`, 
                                        width: `${(duration / 30) * 100}%` 
                                    }} />
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max={30 - duration} 
                                        step="0.5" 
                                        value={startTime} 
                                        onChange={(e) => setStartTime(Number(e.target.value))} 
                                        className="aura-slider" 
                                    />
                                </div>
                            </div>
                        )}

                        {isMusicSearchOpen && (
                            <MusicSearch onSelect={(track) => { setMusic(track); setIsMusicSearchOpen(false); setIsPlaying(true); setStartTime(0); }} onClose={() => setIsMusicSearchOpen(false)} />
                        )}
                        
                        <div className="aura-actions">
                            <div className="aura-tools">
                                <button className="aura-tool-btn" onClick={() => setIsMusicSearchOpen(!isMusicSearchOpen)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                </button>
                                <button className="aura-tool-btn" onClick={() => setCameraState("permission")}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                </button>
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*,video/*" onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setMedia(file);
                                        const reader = new FileReader();
                                        reader.onloadend = () => setPreviewUrl(reader.result);
                                        reader.readAsDataURL(file);
                                    }
                                }} />
                            </div>
                            <button className="aura-share-btn" onClick={handleShare} disabled={isUploading || (!content && !media && !music)}>
                                {isUploading ? <div className="aura-loader"></div> : <><span>Share One-Breath</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></>}
                            </button>
                        </div>

                        {cameraState === "permission" && (
                            <div className="aura-permission-popup">
                                <h3>Zen-Camera Access</h3>
                                <p>Allow ZenChat to capture a moment through your lens?</p>
                                <div className="permission-actions">
                                    <button className="allow-btn" onClick={startCamera}>Allow Access</button>
                                    <button className="deny-btn" onClick={() => { stopCamera(); showToast("Camera breath denied. 🌪️"); }}>Deny</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {toast && <div className="aura-toast">{toast.includes("granted") || toast.includes("successfully") ? "✨" : "🌪️"} {toast}</div>}
        </>,
        document.body
    );
};

export default memo(MomentCreator);
