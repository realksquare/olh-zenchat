import { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import MusicSearch from "./MusicSearch";

const MomentCreator = ({ isOpen, onClose }) => {
    const [content, setContent] = useState("");
    const [music, setMusic] = useState(null);
    const [isMusicSearchOpen, setIsMusicSearchOpen] = useState(false);
    const [duration, setDuration] = useState(18);
    const [startTime, setStartTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [toast, setToast] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const audioRef = useRef(null);
    const seekTimeoutRef = useRef(null);
    const { createMoment, moments } = useMomentStore();
    const { user } = useAuthStore();

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 5000);
    };

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

    const handleShare = async () => {
        if (!content && !music) return;
        const ownMomentsCount = moments.filter(m => (m.userId?._id || m.userId) === user?._id).length;
        if (ownMomentsCount >= 5) {
            showToast("Upload limit reached (5 moments maximum).");
            return;
        }
        setIsUploading(true);

        try {
            let type = music ? "music" : "text";
            await createMoment({ type, content, music: music ? { ...music, duration, startTime } : null });
            showToast("Living the #moment. ✨");
            setTimeout(() => { 
                onClose(); 
                setContent(""); setMusic(null); setStartTime(0);
                setIsPlaying(true);
            }, 1500);
        } catch (err) {
            showToast("Breath lost... try again. 🌪️");
        } finally { setIsUploading(false); }
    };

    const handleClose = () => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="modal-overlay moments-aura-overlay" onClick={handleClose}>
                <div className="moments-aura-content" onClick={(e) => e.stopPropagation()}>
                    <div className="moments-aura-header">
                        <h2 className="moments-aura-title">#moments.</h2>
                        <button className="aura-close-btn" onClick={handleClose}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    <div className="aura-preview-container text-only-preview">
                        <div className="aura-placeholder">
                            <div className="aura-placeholder-icon text-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                            </div>
                            <div className="aura-placeholder-text">
                                <p>Capture your thought</p>
                                <span>Minimalistic. Expressive. 49 characters.</span>
                            </div>
                        </div>
                    </div>

                    <div className="aura-input-section">
                        <textarea 
                            className="aura-textarea" 
                            placeholder="Share your thoughts..." 
                            value={content} 
                            onChange={(e) => setContent(e.target.value)} 
                            maxLength={49} 
                        />
                        <div className="aura-char-count">{content.length}/49</div>
                        
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
                                    <div className="aura-duration-options">
                                        {[18, 24, 30].map((d) => (
                                            <button 
                                                key={d}
                                                className={`duration-opt ${duration === d ? 'active' : ''}`}
                                                onClick={() => {
                                                    setDuration(d);
                                                    if (startTime + d > 30) setStartTime(30 - d);
                                                }}
                                            >
                                                {d}s
                                            </button>
                                        ))}
                                    </div>
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
                                        min={duration} 
                                        max={30} 
                                        step="0.5" 
                                        value={startTime + duration} 
                                        onChange={(e) => setStartTime(Number(e.target.value) - duration)} 
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
                                <button className="aura-tool-btn" onClick={() => setIsMusicSearchOpen(!isMusicSearchOpen)} title="vibe.">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                </button>
                            </div>
                            <button className="aura-share-btn" onClick={handleShare} disabled={isUploading || (!content && !music)}>
                                {isUploading ? <div className="aura-loader"></div> : <><span>Live the #moment.</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {toast && <div className="aura-toast">{toast.includes("lost") ? "🌪️" : "✨"} {toast}</div>}
        </>,
        document.body
    );
};

export default memo(MomentCreator);
