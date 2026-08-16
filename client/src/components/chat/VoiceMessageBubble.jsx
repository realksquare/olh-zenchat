import { useState, useRef, useEffect } from "react";

const BARS = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const CANVAS_HEIGHT = 32;

const decodeWaveform = (base64) => {
    if (!base64) return null;
    try {
        const raw = atob(base64);
        const amps = [];
        for (let i = 0; i < raw.length; i++) amps.push(raw.charCodeAt(i) / 255);
        return amps;
    } catch (_) { return null; }
};

const drawStaticBars = (canvas, amps, fraction = -1) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerY = canvas.height / 2;
    const bars = amps || new Array(BARS).fill(0.3);
    for (let i = 0; i < bars.length; i++) {
        const barH = Math.max(3, Math.round(bars[i] * CANVAS_HEIGHT * 0.85));
        const x = i * (BAR_WIDTH + BAR_GAP);
        const isPlayed = fraction >= 0 && i / bars.length <= fraction;
        ctx.fillStyle = isPlayed ? "#3da5d9" : "rgba(255,255,255,0.20)";
        ctx.beginPath();
        ctx.roundRect(x, centerY - barH / 2, BAR_WIDTH, barH, 1.5);
        ctx.fill();
    }
};

const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
};

const parseDuration = (content) => {
    if (!content) return 0;
    const parts = content.split(":");
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    return parseInt(content) || 0;
};

const CANVAS_WIDTH = BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

const fetchAndCreateBlobUrl = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Fetch failed");
        const blob = await response.blob();
        const contentType = response.headers.get("content-type") || "";
        let mimeType = "audio/webm";
        if (contentType.includes("audio/") || contentType.includes("video/")) {
            mimeType = contentType;
        } else {
            if (url.endsWith(".mp4") || url.endsWith(".m4a")) {
                mimeType = "audio/mp4";
            } else if (url.endsWith(".ogg")) {
                mimeType = "audio/ogg";
            } else if (url.endsWith(".wav")) {
                mimeType = "audio/wav";
            }
        }
        const newBlob = new Blob([blob], { type: mimeType });
        return URL.createObjectURL(newBlob);
    } catch (err) {
        return null;
    }
};

const VoiceMessageBubble = ({ message }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(parseDuration(message.content));
    const [audioError, setAudioError] = useState(false);

    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const ampsRef = useRef(decodeWaveform(message.waveform));

    // Draw initial static bars
    useEffect(() => {
        if (canvasRef.current) drawStaticBars(canvasRef.current, ampsRef.current, -1);
    }, []);

    // Smooth progress update loop
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        let animId;
        const update = () => {
            if (audioRef.current && isPlaying) {
                const cur = audioRef.current.currentTime;
                setCurrentTime(cur);
                const dur = isFinite(audioRef.current.duration) ? audioRef.current.duration : duration;
                const frac = dur ? cur / dur : 0;
                if (canvasRef.current) drawStaticBars(canvasRef.current, ampsRef.current, frac);
                animId = requestAnimationFrame(update);
            }
        };

        if (isPlaying) {
            animId = requestAnimationFrame(update);
        }

        return () => {
            if (animId) cancelAnimationFrame(animId);
        };
    }, [isPlaying, duration]);

    // Build audio element with fallback support
    useEffect(() => {
        if (!message.mediaUrl) return;

        let active = true;
        let blobUrlToRevoke = null;
        const audio = document.createElement("audio");
        audio.preload = "metadata";

        const loadAudioSrc = (srcUrl) => {
            while (audio.firstChild) {
                audio.removeChild(audio.firstChild);
            }

            if (srcUrl.startsWith("blob:") || srcUrl.startsWith("data:")) {
                audio.removeAttribute("src");
                audio.src = srcUrl;
            } else {
                audio.removeAttribute("src");
                // WebM/opus
                const srcEl = document.createElement("source");
                srcEl.src = srcUrl;
                srcEl.type = "audio/webm; codecs=opus";
                audio.appendChild(srcEl);

                // Plain WebM
                const srcEl2 = document.createElement("source");
                srcEl2.src = srcUrl;
                srcEl2.type = "audio/webm";
                audio.appendChild(srcEl2);

                // MP4/AAC
                const srcEl3 = document.createElement("source");
                srcEl3.src = srcUrl;
                srcEl3.type = "audio/mp4";
                audio.appendChild(srcEl3);
            }
        };

        const tryLoadWithFallback = async () => {
            if (message.mediaUrl.includes("/raw/upload/")) {
                const bUrl = await fetchAndCreateBlobUrl(message.mediaUrl);
                if (!active) return;
                if (bUrl) {
                    blobUrlToRevoke = bUrl;
                    loadAudioSrc(bUrl);
                    audio.load();
                    return;
                }
            }
            loadAudioSrc(message.mediaUrl);
        };

        tryLoadWithFallback();

        audio.onloadedmetadata = () => {
            if (active && audio.duration && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };

        audio.ontimeupdate = () => {
            if (active) {
                setCurrentTime(audio.currentTime);
                const dur = isFinite(audio.duration) ? audio.duration : duration;
                const frac = dur ? audio.currentTime / dur : 0;
                if (canvasRef.current && !isPlaying) {
                    drawStaticBars(canvasRef.current, ampsRef.current, frac);
                }
            }
        };

        audio.onended = () => {
            if (active) {
                setIsPlaying(false);
                setCurrentTime(0);
                if (canvasRef.current) drawStaticBars(canvasRef.current, ampsRef.current, -1);
            }
        };

        let fallbackAttempted = false;
        audio.onerror = async () => {
            if (!active) return;
            if (!fallbackAttempted && !message.mediaUrl.startsWith("blob:") && !message.mediaUrl.includes("/raw/upload/")) {
                fallbackAttempted = true;
                const bUrl = await fetchAndCreateBlobUrl(message.mediaUrl);
                if (!active) return;
                if (bUrl) {
                    blobUrlToRevoke = bUrl;
                    loadAudioSrc(bUrl);
                    audio.load();
                    if (isPlaying) {
                        audio.play().catch(() => {});
                    }
                    return;
                }
            }
            setAudioError(true);
        };

        audioRef.current = audio;

        return () => {
            active = false;
            audio.pause();
            audio.src = "";
            audioRef.current = null;
            if (blobUrlToRevoke) {
                URL.revokeObjectURL(blobUrlToRevoke);
            }
        };
    }, [message.mediaUrl]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio || audioError) return;
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().then(() => {
                setIsPlaying(true);
            }).catch(err => {
                setAudioError(true);
            });
        }
    };

    const handleCanvasClick = (e) => {
        const audio = audioRef.current;
        if (!audio || audioError) return;
        const dur = isFinite(audio.duration) ? audio.duration : duration;
        if (!dur || !isFinite(dur)) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        const targetTime = frac * dur;
        try {
            audio.currentTime = targetTime;
            setCurrentTime(targetTime);
            if (canvasRef.current) drawStaticBars(canvasRef.current, ampsRef.current, frac);
        } catch (err) {
            // silent catch
        }
    };

    return (
        <div className="voice-message-bubble">
            <button
                className="voice-play-btn"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
                disabled={audioError || !message.mediaUrl}
                title={audioError ? "Audio unavailable" : !message.mediaUrl ? "Decrypting voice message..." : undefined}
            >
                {audioError ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                ) : !message.mediaUrl ? (
                    <div className="loader-sm" style={{ width: '14px', height: '14px', border: '2px solid var(--color-border, rgba(255, 255, 255, 0.08))', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'aura-spin 0.8s linear infinite' }} />
                ) : isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
            </button>
            <canvas
                ref={canvasRef}
                className="voice-waveform-canvas"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onClick={handleCanvasClick}
                style={{ cursor: audioError ? "default" : "pointer" }}
                aria-label="Voice message waveform"
            />
            <span className="voice-bubble-duration">
                ({formatTime(currentTime)}/{formatTime(duration)})
            </span>
        </div>
    );
};

export default VoiceMessageBubble;
