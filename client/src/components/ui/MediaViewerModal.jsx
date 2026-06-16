import React, { useEffect } from 'react';

const MediaViewerModal = ({ url, type, username, isViewOnce, onClose }) => {
    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleDownload = async (e) => {
        e.stopPropagation();
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            
            // Extract extension from cloudinary URL if possible, else guess
            let extension = type === 'video' ? 'mp4' : 'jpg';
            const urlParts = url.split('.');
            const lastPart = urlParts[urlParts.length - 1];
            if (lastPart.length <= 4) {
                extension = lastPart.split('?')[0]; // strip query params
            }
            
            a.download = `${type}_zenchat_${username}.${extension}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed:", error);
            // Fallback for CORS issues
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_zenchat_${username}`;
            a.target = '_blank';
            a.click();
        }
    };

    return (
        <div className="media-viewer-overlay" onClick={onClose} onContextMenu={isViewOnce ? (e) => e.preventDefault() : undefined} style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)'
        }}>
            <button className="media-viewer-close" onClick={onClose} style={{
                position: 'absolute', top: '20px', right: '20px', background: 'var(--color-overlay, rgba(255, 255, 255, 0.1))', 
                border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', 
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                transition: 'background 0.2s'
            }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-border, rgba(255, 255, 255, 0.08))'}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            {!isViewOnce && (
                <button className="media-viewer-download" onClick={handleDownload} style={{
                    position: 'absolute', top: '70px', right: '20px', background: 'var(--color-overlay, rgba(255, 255, 255, 0.1))', 
                    border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                    transition: 'background 0.2s'
                }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-border, rgba(255, 255, 255, 0.08))'} title="Download Media">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
            )}

            <div className="media-viewer-content" onClick={(e) => e.stopPropagation()} style={{
                maxWidth: '90%', maxHeight: '90%', position: 'relative', display: 'flex', justifyContent: 'center'
            }}>
                {type === 'video' ? (
                    <video src={url} controls autoPlay onContextMenu={isViewOnce ? (e) => e.preventDefault() : undefined} style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', outline: 'none' }} />
                ) : (
                    <img src={url} alt="Viewed media" onContextMenu={isViewOnce ? (e) => e.preventDefault() : undefined} onDragStart={isViewOnce ? (e) => e.preventDefault() : undefined} style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain', pointerEvents: isViewOnce ? 'none' : 'auto' }} />
                )}
            </div>
        </div>
    );
};

export default MediaViewerModal;
