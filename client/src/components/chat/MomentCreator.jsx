import { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import { useAuthStore } from "../../stores/authStore";
import MusicSearch from "./MusicSearch";
import axios from "axios";

const FILTER_PRESETS = [
    { id: "none", name: "Original", style: {} },
    { id: "warm", name: "Warm", style: { filter: "sepia(0.3) saturate(1.2) contrast(1.1)" } },
    { id: "cold", name: "Cold", style: { filter: "hue-rotate(180deg) saturate(1.1) contrast(1.05)" } },
    { id: "vivid", name: "Vivid", style: { filter: "saturate(1.6) contrast(1.15)" } },
    { id: "fade", name: "Fade", style: { filter: "brightness(1.1) contrast(0.95) saturate(0.9)" } },
    { id: "bw", name: "B&W", style: { filter: "grayscale(1) contrast(1.2)" } }
];

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const compressImage = (file, quality = 0.78) => new Promise((resolve) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return resolve(file);
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            let scale = 1;
            const targetBytes = 300 * 1024;
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

const suggestMoodGenre = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("sad") || lower.includes("cry") || lower.includes("hurt") || lower.includes("alone") || lower.includes("miss")) return "acoustic-sad";
    if (lower.includes("happy") || lower.includes("joy") || lower.includes("excited") || lower.includes("dance") || lower.includes("party")) return "pop-energetic";
    if (lower.includes("chill") || lower.includes("peace") || lower.includes("calm") || lower.includes("relax") || lower.includes("sleep")) return "lofi-calm";
    if (lower.includes("love") || lower.includes("heart") || lower.includes("babe") || lower.includes("date")) return "romantic-indie";
    if (lower.includes("study") || lower.includes("focus") || lower.includes("work")) return "focus-ambient";
    return "";
};

const MomentCreator = ({ isOpen, onClose }) => {
    const [creatorStep, setCreatorStep] = useState("select"); // "select" | "create"
    const [momentType, setMomentType] = useState("text"); // "text" | "image"
    
    // Form States
    const [content, setContent] = useState(""); // text moment text
    const [caption, setCaption] = useState(""); // image moment caption
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState("");
    const [activeFilter, setActiveFilter] = useState("none");
    const [disappearHours, setDisappearHours] = useState(24);
    
    // Geolocation States
    const [locationText, setLocationText] = useState("");
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [showLocationPill, setShowLocationPill] = useState(true);
    
    // Music States
    const [music, setMusic] = useState(null);
    const [isMusicSearchOpen, setIsMusicSearchOpen] = useState(false);
    const [duration, setDuration] = useState(18);
    const [startTime, setStartTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    
    // Auto-suggest state
    const [suggestedGenre, setSuggestedGenre] = useState("");
    
    // System States
    const [toast, setToast] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [imageQuality, setImageQuality] = useState("standard"); // "standard" | "og"
    
    const audioRef = useRef(null);
    const seekTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    
    const { createMoment } = useMomentStore();
    const userId = useAuthStore((s) => s.user?._id);

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    // Handle audio preview loop
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
                        audioRef.current.play().catch(() => console.log("Audio blocked"));
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

    // Tone auto-suggestion effect
    useEffect(() => {
        const textToAnalyze = momentType === "text" ? content : caption;
        if (textToAnalyze.trim().length >= 3) {
            const timer = setTimeout(() => {
                const genre = suggestMoodGenre(textToAnalyze);
                setSuggestedGenre(genre);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setSuggestedGenre("");
        }
    }, [content, caption, momentType]);

    // Fetch dynamic location
    const handleFetchLocation = () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser");
            return;
        }
        setIsFetchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                    const data = await res.json();
                    if (data && data.address) {
                        const addr = data.address;
                        const city = addr.city || addr.town || addr.village || addr.suburb || "";
                        const state = addr.state || "";
                        const country = addr.country || "";
                        const parts = [city, state, country].filter(p => p !== "");
                        const text = parts.join(", ");
                        setLocationText(text);
                        setShowLocationPill(true);
                    } else {
                        showToast("Unable to resolve location address");
                    }
                } catch (err) {
                    showToast("Failed to connect to geocoding service");
                } finally {
                    setIsFetchingLocation(false);
                }
            },
            () => {
                showToast("Location access denied or timed out");
                setIsFetchingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    // File Selection Gating
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast("File size exceeds 5MB limit");
            return;
        }

        setSelectedFile(file);
        setFilePreview(URL.createObjectURL(file));
        setActiveFilter("none");
    };

    // Share moment to server
    const handleShare = async () => {
        const isText = momentType === "text";
        const bodyContent = isText ? content : caption;
        
        // Validation Checks
        if (isText && (!content.trim() || content.trim().length < 3)) {
            showToast("Thought must be at least 3 characters");
            return;
        }
        if (!isText && !selectedFile) {
            showToast("Please upload an image first");
            return;
        }
        if (!isText && caption.trim().length > 0 && caption.trim().length < 3) {
            showToast("Caption must be at least 3 characters");
            return;
        }

        const ownMomentsCount = useMomentStore.getState().moments.filter(m => (m.userId?._id || m.userId) === userId).length;
        if (ownMomentsCount >= 5) {
            showToast("Upload limit reached (5 moments maximum)");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            let uploadedUrl = "";
            
            // Upload image to Cloudinary if it's an image moment
            if (!isText && selectedFile) {
                const cloudName = "du4nvei7j";
                const uploadPreset = "ml_default";
                const formData = new FormData();
                let fileToUpload = selectedFile;
                if (imageQuality === "standard") fileToUpload = await compressImage(selectedFile);
                formData.append("file", fileToUpload);
                formData.append("upload_preset", uploadPreset);

                const res = await axios.post(
                    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                    formData,
                    {
                        onUploadProgress: (p) => {
                            const percent = Math.round((p.loaded * 100) / p.total);
                            setUploadProgress(percent);
                        }
                    }
                );
                uploadedUrl = res.data.secure_url;
            }

            const momentPayload = {
                type: isText ? (music ? "music" : "text") : "image",
                content: isText ? content : "",
                mediaUrl: uploadedUrl,
                caption: !isText ? caption : "",
                filter: !isText ? activeFilter : "none",
                locationTag: (!isText && showLocationPill) ? locationText : "",
                disappearAfterHours: disappearHours,
                music: music ? {
                    trackId: music.id || null,
                    source: music.source || null,
                    title: music.title,
                    artist: music.artist,
                    previewUrl: music.previewUrl,
                    coverUrl: music.coverUrl,
                    duration,
                    startTime
                } : null
            };

            await createMoment(momentPayload);
            showToast("Moment shared successfully");
            
            setTimeout(() => { 
                handleReset();
                onClose(); 
            }, 1200);
        } catch (err) {
            showToast("Failed to share, please try again");
        } finally { 
            setIsUploading(false); 
        }
    };

    const handleReset = () => {
        setCreatorStep("select");
        setContent("");
        setCaption("");
        setSelectedFile(null);
        setFilePreview("");
        setActiveFilter("none");
        setLocationText("");
        setShowLocationPill(true);
        setMusic(null);
        setStartTime(0);
        setIsPlaying(true);
        setDisappearHours(24);
        setSuggestedGenre("");
        setUploadProgress(0);
        setImageQuality("standard");
    };

    const handleClose = () => {
        if (audioRef.current) { 
            audioRef.current.pause(); 
            audioRef.current = null; 
        }
        handleReset();
        onClose();
    };

    const getPreviewFilterStyle = () => {
        const preset = FILTER_PRESETS.find(f => f.id === activeFilter);
        return preset ? preset.style : {};
    };

    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="modal-overlay moments-aura-overlay" onClick={handleClose}>
                <div className="moments-aura-content" onClick={(e) => e.stopPropagation()} style={{ userSelect: isUploading ? 'none' : 'auto', WebkitUserSelect: isUploading ? 'none' : 'auto' }}>
                    <div className="moments-aura-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {creatorStep === "create" && (
                                <button className="aura-back-btn" onClick={() => { setCreatorStep("select"); handleReset(); }} style={{ background: 'none', border: 'none', color: '#94a3b8', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                                    </svg>
                                </button>
                            )}
                            <h2 className="moments-aura-title">Share a Moment</h2>
                        </div>
                        <button className="aura-close-btn" onClick={handleClose}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {creatorStep === "select" ? (
                        /* Step 1: Type Selection Screen */
                        <div className="moments-select-step" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 8px' }}>Select the type of moment you want to share with your contacts.</p>
                            
                            <div className="moments-card-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%' }}>
                                <div 
                                    className="moments-card-select"
                                    onClick={() => { setMomentType("text"); setCreatorStep("create"); }}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '16px',
                                        padding: '24px 16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '12px',
                                        textAlign: 'center'
                                    }}
                                >
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                        </svg>
                                    </div>
                                    <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>Write a thought</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Express in minimalistic text</span>
                                </div>

                                <div 
                                    className="moments-card-select"
                                    onClick={() => { setMomentType("image"); setCreatorStep("create"); }}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '16px',
                                        padding: '24px 16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '12px',
                                        textAlign: 'center'
                                    }}
                                >
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <polyline points="21 15 16 10 5 21" />
                                        </svg>
                                    </div>
                                    <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>Share a photo</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Post a captured photo with filters</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Step 2: Content Creation Screen */
                        <div className="moments-creator-step">
                            {momentType === "text" ? (
                                /* Text Moment Creation View */
                                <>
                                    <div className="aura-preview-container text-only-preview">
                                        <div className="aura-placeholder">
                                            <div className="aura-placeholder-icon text-icon">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                                </svg>
                                            </div>
                                            <div className="aura-placeholder-text">
                                                <p>Capture your thought</p>
                                                <span>Minimalistic. Expressive. 3 to 49 characters.</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="aura-input-section">
                                        <textarea 
                                            className="aura-textarea" 
                                            placeholder="Write your thought here..." 
                                            value={content} 
                                            onChange={(e) => setContent(e.target.value)} 
                                            maxLength={49} 
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                            <span>Min 3 characters</span>
                                            <span>{content.length}/49</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Image Moment Creation View */
                                <>
                                    <div className="aura-preview-container image-preview-wrapper" style={{ position: 'relative', height: '240px', background: '#0a0d14', borderRadius: '16px', margin: '0 28px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {filePreview ? (
                                            <>
                                                <img 
                                                    src={filePreview} 
                                                    alt="Preview" 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', ...getPreviewFilterStyle() }}
                                                />
                                                
                                                {/* Caption Overlay */}
                                                {caption.trim().length > 0 && (
                                                    <div style={{ position: 'absolute', bottom: '38px', left: '50%', transform: 'translateX(-50%)', width: '85%', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', padding: '6px 12px', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.85rem', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                        {caption}
                                                    </div>
                                                )}

                                                {/* Location Tag Pill */}
                                                {locationText && showLocationPill && (
                                                    <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                        <span style={{ fontSize: '0.68rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{locationText}</span>
                                                        <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: '600' }}>#Moment. on OLH ZenChat</span>
                                                    </div>
                                                )}
                                                
                                                {/* Quality Toggle */}
                                                {filePreview && (
                                                    <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
                                                        <button
                                                            onClick={() => setImageQuality(q => q === "og" ? "standard" : "og")}
                                                            style={{
                                                                background: imageQuality === "og" ? 'rgba(61,165,217,0.25)' : 'rgba(15,23,42,0.75)',
                                                                backdropFilter: 'blur(6px)',
                                                                border: imageQuality === "og" ? '1px solid rgba(61,165,217,0.6)' : '1px solid rgba(255,255,255,0.1)',
                                                                borderRadius: '6px',
                                                                padding: '3px 8px',
                                                                color: imageQuality === "og" ? 'var(--color-primary)' : '#94a3b8',
                                                                fontSize: '0.62rem',
                                                                fontWeight: '900',
                                                                cursor: 'pointer',
                                                                letterSpacing: '0.5px'
                                                            }}
                                                        >
                                                            {imageQuality === "og" ? "OG" : "STD"}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Disappear Timer Pill */}
                                                <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', padding: '3px 8px', borderRadius: '12px', fontSize: '0.62rem', fontWeight: 'bold', color: '#cbd5e1' }}>
                                                    Expires in {disappearHours}h
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '24px' }}>
                                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                                        <polyline points="21 15 16 10 5 21" />
                                                    </svg>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => cameraInputRef.current?.click()} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '8px 16px', color: '#3b82f6', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                                        Camera
                                                    </button>
                                                    <button onClick={() => fileInputRef.current?.click()} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '8px 16px', color: '#10b981', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                                        Library
                                                    </button>
                                                </div>
                                                <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
                                                <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Max size limit: 5MB</span>
                                            </div>
                                        )}
                                    </div>

                                    {filePreview && (
                                        <div className="aura-input-section" style={{ marginTop: '16px' }}>
                                            {/* Live Filter Preset Strip */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#64748b' }}>Presets</span>
                                                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', width: '100%' }} className="filter-scroll-strip">
                                                    {FILTER_PRESETS.map((f) => (
                                                        <button 
                                                            key={f.id}
                                                            onClick={() => setActiveFilter(f.id)}
                                                            style={{
                                                                flexShrink: 0,
                                                                background: activeFilter === f.id ? 'rgba(61,165,217,0.15)' : 'rgba(255,255,255,0.02)',
                                                                border: activeFilter === f.id ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.06)',
                                                                color: activeFilter === f.id ? 'var(--color-primary)' : '#94a3b8',
                                                                padding: '6px 12px',
                                                                borderRadius: '16px',
                                                                fontSize: '0.72rem',
                                                                fontWeight: '600',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            {f.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Caption input */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#64748b' }}>Caption</span>
                                                <input 
                                                    type="text"
                                                    className="aura-textarea"
                                                    placeholder="Add a floating caption..."
                                                    value={caption}
                                                    onChange={(e) => setCaption(e.target.value)}
                                                    maxLength={49}
                                                    style={{ height: '38px', padding: '8px 12px', borderRadius: '10px' }}
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b' }}>
                                                    <span>Optional &bull; Min 3 characters</span>
                                                    <span>{caption.length}/49</span>
                                                </div>
                                            </div>

                                            {/* Location Tag Control */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '12px', marginBottom: '14px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#cbd5e1' }}>Location tag</span>
                                                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{locationText ? locationText : "Append approximate current location"}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {locationText && (
                                                        <button 
                                                            onClick={() => setShowLocationPill(!showLocationPill)} 
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: showLocationPill ? 'var(--color-primary)' : '#64748b',
                                                                cursor: 'pointer',
                                                                padding: '4px'
                                                            }}
                                                            title={showLocationPill ? "Hide Location Overlay" : "Show Location Overlay"}
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                {showLocationPill ? (
                                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                ) : (
                                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                                )}
                                                                {showLocationPill && <circle cx="12" cy="12" r="3" />}
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={handleFetchLocation}
                                                        disabled={isFetchingLocation}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            borderRadius: '10px',
                                                            padding: '6px 12px',
                                                            color: '#f1f5f9',
                                                            fontSize: '0.72rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        {isFetchingLocation ? (
                                                            <div className="aura-loader" style={{ width: '10px', height: '10px' }} />
                                                        ) : (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                                                        )}
                                                        {locationText ? "Refresh" : "Add Location"}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Disappear Timer CONTROL */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '12px', marginBottom: '14px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#cbd5e1' }}>Disappear timer</span>
                                                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Select how long this moment stays visible</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '8px' }}>
                                                    {[7, 18, 24].map((h) => (
                                                        <button 
                                                            key={h}
                                                            onClick={() => setDisappearHours(h)}
                                                            style={{
                                                                background: disappearHours === h ? 'rgba(255,255,255,0.08)' : 'none',
                                                                border: 'none',
                                                                color: disappearHours === h ? 'var(--color-primary)' : '#94a3b8',
                                                                padding: '4px 10px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            {h}h
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Render Music / Vibe Controls if Content is Added / Staged */}
                            {((momentType === "text" && content.trim().length >= 3) || (momentType === "image" && filePreview)) && (
                                <div className="aura-input-section" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '14px', margin: '0 28px' }}>
                                    {music && (
                                        <div className="aura-music-cropper">
                                            {/* Row 1: play | title • artist | remove */}
                                            <div className="cropper-label">
                                                <button className="cropper-play-btn" onClick={() => setIsPlaying(!isPlaying)}>
                                                    {isPlaying ? (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                                    ) : (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                                    )}
                                                </button>
                                                <span className="cropper-title-text" style={{ textOverflow: 'clip' }}>
                                                    <div className={(music.title + music.artist).length > 25 ? "marquee-bidirectional" : ""} style={{ display: 'inline-block' }}>
                                                        {(music.title + ' • ' + music.artist).replace(/\.\.\.$/, '')}
                                                    </div>
                                                </span>
                                                <button className="aura-remove-music" onClick={() => { setMusic(null); setIsPlaying(false); }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                </button>
                                            </div>
                                            {/* Row 2: duration pill */}
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
                                        <MusicSearch 
                                            initialQuery={suggestedGenre}
                                            onSelect={(track) => { setMusic(track); setIsMusicSearchOpen(false); setIsPlaying(true); setStartTime(0); }} 
                                            onClose={() => setIsMusicSearchOpen(false)} 
                                        />
                                    )}

                                    {/* Tone music prefill suggest pill */}
                                    {suggestedGenre && !music && !isMusicSearchOpen && (
                                        <div 
                                            onClick={() => setIsMusicSearchOpen(true)}
                                            style={{
                                                background: 'rgba(61,165,217,0.06)',
                                                border: '1px dashed rgba(61,165,217,0.3)',
                                                borderRadius: '12px',
                                                padding: '8px 12px',
                                                color: '#f1f5f9',
                                                fontSize: '0.72rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: '14px',
                                                animation: 'fadeIn 0.3s ease-out'
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                                Suggested for your vibe: <strong style={{ color: 'var(--color-primary)', textTransform: 'capitalize' }}>{suggestedGenre.replace('-', ' ')}</strong>
                                            </span>
                                            <span style={{ fontSize: '0.65rem', opacity: 0.8, textDecoration: 'underline' }}>Apply vibe</span>
                                        </div>
                                    )}

                                    <div className="aura-actions" style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 24px' }}>
                                        <div className="aura-tools">
                                            <button className="aura-tool-btn" onClick={() => setIsMusicSearchOpen(!isMusicSearchOpen)} title="Vibe tracker">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                            </button>
                                        </div>
                                        
                                        <button 
                                            className="aura-share-btn" 
                                            onClick={handleShare} 
                                            disabled={
                                                isUploading || 
                                                (momentType === "text" && (!content.trim() || content.trim().length < 3)) ||
                                                (momentType === "image" && !selectedFile) ||
                                                (momentType === "image" && caption.trim().length > 0 && caption.trim().length < 3)
                                            }
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '10px 20px',
                                                borderRadius: '24px',
                                                border: 'none',
                                                background: 'var(--color-primary)',
                                                color: '#fff',
                                                fontWeight: 'bold',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {isUploading ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {/* Circular progress display */}
                                                    <svg width="16" height="16" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                                        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                                                        <circle cx="18" cy="18" r="16" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="100" strokeDashoffset={100 - uploadProgress} />
                                                    </svg>
                                                    <span>Sharing ({uploadProgress}%)</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <span>Share Moment</span>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                    </svg>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {toast && (
                <div className="zen-toast zen-toast-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    {toast}
                </div>
            )}
        </>,
        document.body
    );
};

export default memo(MomentCreator);
