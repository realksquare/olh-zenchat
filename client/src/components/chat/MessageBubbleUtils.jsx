const HeartReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-heart" style={{ filter: "drop-shadow(0 2px 6px rgba(239, 68, 68, 0.45))" }}>
        <defs>
            <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff5a79" />
                <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
        </defs>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="url(#heartGrad)" stroke="#ffffff" strokeWidth="1.8" />
    </svg>
);

const ThumbsUpReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-thumbsup" style={{ filter: "drop-shadow(0 2px 6px rgba(245, 158, 11, 0.45))" }}>
        <defs>
            <linearGradient id="thumbsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
        </defs>
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3l3.15-6.3a2.12 2.12 0 0 1 4.05 1.18z" fill="url(#thumbsGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <path d="M7 10v12" stroke="#ffffff" strokeWidth="1.8" />
    </svg>
);

const LaughingReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-laughing" style={{ filter: "drop-shadow(0 2px 6px rgba(234, 179, 8, 0.45))" }}>
        <defs>
            <linearGradient id="laughGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#laughGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <path d="M8 9.5 9.5 11 8 12.5" stroke="#1e293b" strokeWidth="2" />
        <path d="M16 9.5 14.5 11 16 12.5" stroke="#1e293b" strokeWidth="2" />
        <path d="M9 15a3 3 0 0 0 6 0H9z" fill="#1e293b" stroke="none" />
        <g className="r-tear-drop" style={{ transformOrigin: 'center' }}>
            <path d="M6 11c-.3.5-.5 1-.5 1.4a1 1 0 0 0 2 0c0-.4-.2-.9-.5-1.4a.1.1 0 0 0-.2 0z" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.8" />
            <path d="M18 11c-.3.5-.5 1-.5 1.4a1 1 0 0 0 2 0c0-.4-.2-.9-.5-1.4a.1.1 0 0 0-.2 0z" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.8" />
        </g>
    </svg>
);

const SadReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-sad" style={{ filter: "drop-shadow(0 2px 6px rgba(14, 165, 233, 0.45))" }}>
        <defs>
            <linearGradient id="sadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#sadGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <line x1="9" y1="9" x2="9" y2="11" stroke="#1e293b" strokeWidth="2" />
        <line x1="15" y1="9" x2="15" y2="11" stroke="#1e293b" strokeWidth="2" />
        <path d="M16 17a4 4 0 0 0-8 0" stroke="#1e293b" strokeWidth="2" />
        <path d="M9.2 11.5c.2.8-.2 1.5-.7 1.5s-.7-.7-.7-1.5.5-1.5.7-1.5.5.7.7 1.5z" fill="#3b82f6" stroke="none" />
    </svg>
);

const AngryReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-angry" style={{ filter: "drop-shadow(0 2px 6px rgba(244, 63, 94, 0.45))" }}>
        <defs>
            <linearGradient id="angryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#angryGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <path d="m8 9 2.5 1" stroke="#ffffff" strokeWidth="2" />
        <path d="m16 9-2.5 1" stroke="#ffffff" strokeWidth="2" />
        <circle cx="9" cy="12" r="1" fill="#ffffff" stroke="none" />
        <circle cx="15" cy="12" r="1" fill="#ffffff" stroke="none" />
        <path d="M14 16.5a2 2 0 0 0-4 0" stroke="#ffffff" strokeWidth="2" />
    </svg>
);

const HifiReaction = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="reaction-hifi" style={{ filter: "drop-shadow(0 2px 6px rgba(167, 139, 250, 0.45))" }}>
        <defs>
            <linearGradient id="hifiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
        </defs>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" fill="url(#hifiGrad)" stroke="#ffffff" strokeWidth="1.8" />
        <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5 5 3Z" fill="#ffffff" stroke="none" opacity="0.8" />
        <path d="m19 15 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" fill="#ffffff" stroke="none" opacity="0.8" />
    </svg>
);

export const REACTIONS_MAP = {
    heart: HeartReaction,
    thumbsup: ThumbsUpReaction,
    laughing: LaughingReaction,
    sad: SadReaction,
    angry: AngryReaction,
    hifi: HifiReaction
};

export const getFileName = (url, content) => {
    if (!url) return content || "Document";
    try {
        const decoded = decodeURIComponent(url);
        const parts = decoded.split('/');
        const filename = parts[parts.length - 1];
        const hasExtension = (str) => /\.[a-zA-Z0-9]{2,5}$/.test(str);
        if (content && hasExtension(content)) {
            return content;
        }
        return filename || content || "Document";
    } catch (e) {
        return content || "Document";
    }
};

export const triggerDownload = async (e, mediaUrl, content, senderUsername) => {
    e.preventDefault();
    e.stopPropagation();
    try {
        const fileName = getFileName(mediaUrl, content);
        const dotIndex = fileName.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
        const extension = dotIndex !== -1 ? fileName.slice(dotIndex) : '';
        const downloadName = `${baseName}_${senderUsername}_zenchat${extension}`;

        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error("Download failed:", err);
        window.open(mediaUrl, "_blank");
    }
};
