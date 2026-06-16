import React, { useEffect, useState } from 'react';

const DocViewerModal = ({ url, fileName, onClose }) => {
    const [textContent, setTextContent] = useState('');
    const [loadingText, setLoadingText] = useState(false);
    const fileExtension = fileName?.split('.').pop()?.toLowerCase() || '';

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Fetch text content if it's a text file
    useEffect(() => {
        if (fileExtension === 'txt') {
            setLoadingText(true);
            fetch(url)
                .then((res) => res.text())
                .then((text) => {
                    setTextContent(text);
                    setLoadingText(false);
                })
                .catch((err) => {
                    console.error('Error fetching text file:', err);
                    setTextContent('Failed to load text file content.');
                    setLoadingText(false);
                });
        }
    }, [url, fileExtension]);

    const handleDownload = async (e) => {
        e.stopPropagation();
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName || 'document';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'document';
            a.target = '_blank';
            a.click();
        }
    };

    const isPDF = fileExtension === 'pdf';
    const isTXT = fileExtension === 'txt';

    return (
        <div className="media-viewer-overlay" onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(9, 13, 20, 0.95)', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(12px)'
        }}>
            {/* Close Button */}
            <button className="media-viewer-close" onClick={onClose} style={{
                position: 'absolute', top: '20px', right: '20px', background: 'var(--color-overlay, rgba(255, 255, 255, 0.06))', 
                border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))', color: 'white', borderRadius: '50%', width: '42px', height: '42px', 
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                transition: 'all 0.2s'
            }} onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                e.currentTarget.style.transform = 'scale(1.05)';
            }} onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.transform = 'scale(1)';
            }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            {/* Download Button */}
            <button className="media-viewer-download" onClick={handleDownload} style={{
                position: 'absolute', top: '74px', right: '20px', background: 'rgba(61, 165, 217, 0.1)', 
                border: '1px solid rgba(61, 165, 217, 0.2)', color: 'var(--color-primary)', borderRadius: '50%', width: '42px', height: '42px', 
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                transition: 'all 0.2s'
            }} onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--color-primary)';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'scale(1.05)';
            }} onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(61, 165, 217, 0.1)';
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.transform = 'scale(1)';
            }} title="Download Document">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>

            {/* Document Content Area */}
            <div className="doc-viewer-content-wrap" onClick={(e) => e.stopPropagation()} style={{
                width: 'min(90vw, 900px)', height: 'min(82vh, 700px)', background: "var(--body-bg, #0e1117)", 
                border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', display: 'flex', 
                flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.6)'
            }}>
                {/* Titlebar */}
                <div style={{
                    padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', 
                    display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '12px'
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <span style={{
                        color: 'white', fontSize: '0.92rem', fontWeight: '700', 
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        {fileName}
                    </span>
                    <span style={{
                        fontSize: '0.72rem', background: 'var(--color-overlay, rgba(255, 255, 255, 0.06))', color: 'var(--color-text-muted, rgba(255, 255, 255, 0.5))',
                        padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px'
                    }}>
                        {fileExtension || 'unknown'}
                    </span>
                </div>

                {/* Preview Frame */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#090d14' }}>
                    {isPDF ? (
                        <iframe 
                            src={`${url}#toolbar=0`} 
                            title={fileName} 
                            style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} 
                        />
                    ) : isTXT ? (
                        loadingText ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                                <div className="loader" style={{ marginRight: '10px' }} /> Loading text content...
                            </div>
                        ) : (
                            <pre style={{
                                margin: 0, padding: '24px', width: '100%', height: '100%', boxSizing: 'border-box',
                                overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                color: '#e2e8f0', fontSize: '0.88rem', fontFamily: '"Courier New", Courier, monospace', 
                                lineHeight: '1.6', background: '#0b0f17'
                            }}>
                                {textContent}
                            </pre>
                        )
                    ) : (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', 
                            justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center'
                        }}>
                            <div style={{
                                background: 'rgba(61, 165, 217, 0.05)', borderRadius: '24px', 
                                width: '80px', height: '80px', display: 'flex', alignItems: 'center', 
                                justifyContent: 'center', marginBottom: '20px', border: '1px solid rgba(61, 165, 217, 0.1)'
                            }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                            </div>
                            <h3 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.2rem', fontWeight: '800' }}>No Preview Available</h3>
                            <p style={{ color: '#94a3b8', margin: '0 0 24px', fontSize: '0.9rem', maxWidth: '360px', lineHeight: '1.5' }}>
                                This file type ({fileExtension}) cannot be viewed natively in the browser. You can download the file to view it on your device.
                            </p>
                            <button onClick={handleDownload} style={{
                                background: 'var(--color-primary)', border: 'none', color: 'white', 
                                padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', 
                                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                            }} onMouseOver={e => e.currentTarget.style.opacity = 0.9} onMouseOut={e => e.currentTarget.style.opacity = 1}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                <span>Download File</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocViewerModal;
