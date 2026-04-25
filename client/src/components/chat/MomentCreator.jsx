import { useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useMomentStore } from "../../stores/momentStore";
import axiosInstance from "../../utils/axios";

const MomentCreator = ({ isOpen, onClose }) => {
    const [content, setContent] = useState("");
    const [media, setMedia] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
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
                type,
                content,
                mediaUrl
            });

            onClose();
            setContent("");
            setMedia(null);
            setPreviewUrl(null);
        } catch (err) {
            console.error("Failed to share moment:", err);
        } finally {
            setIsUploading(false);
        }
    };

    return createPortal(
        <div className="modal-overlay moment-creator-overlay" onClick={onClose}>
            <div className="moment-creator-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="creator-preview-area">
                    {previewUrl ? (
                        media?.type.startsWith("video") ? (
                            <video src={previewUrl} autoPlay muted loop />
                        ) : (
                            <img src={previewUrl} alt="Preview" />
                        )
                    ) : (
                        <div className="creator-placeholder">
                            <p>Capture a breath...</p>
                        </div>
                    )}
                </div>

                <div className="creator-controls">
                    <textarea 
                        placeholder="What's on your mind?"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        maxLength={150}
                    />
                    
                    <div className="creator-actions">
                        <button className="icon-btn" onClick={() => fileInputRef.current?.click()}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            accept="image/*,video/*"
                            onChange={handleFileChange}
                        />

                        <button 
                            className="btn btn-primary share-moment-btn" 
                            onClick={handleShare}
                            disabled={isUploading || (!content && !media)}
                        >
                            {isUploading ? "Exhaling..." : "Share One-Breath"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(MomentCreator);
