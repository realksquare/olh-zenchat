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
        for (let i = 0; i < raw.length; i++) {
            amps.push(raw.charCodeAt(i) / 255);
        }
        return amps;
    } catch (_) {
        return null;
    }
};

const drawStaticBars = (canvas, amps, fraction = -1) => {
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

const VoiceMessageBubble = ({ message }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(parseDuration(message.content));
    const [playFraction, setPlayFraction] = useState(-1);

    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const ampsRef = useRef(decodeWaveform(message.waveform));

    const canvasWidth = BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

    // Draw initial static bars
    useEffect(() => {
        if (canvasRef.current) {
            drawStaticBars(canvasRef.current, ampsRef.current, -1);
        }
    }, []);

    // Init audio element
    useEffect(() => {
        if (!message.mediaUrl) return;
        const audio = new Audio(message.mediaUrl);
        audioRef.current = audio;

        audio.onloadedmetadata = () => {
            if (audio.duration && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };
        audio.ontimeupdate = () => {
            setCurrentTime(audio.currentTime);
            const frac = audio.duration ? audio.currentTime / audio.duration : 0;
            setPlayFraction(frac);
            if (canvasRef.current) {
                drawStaticBars(canvasRef.current, ampsRef.current, frac);
            }
        };
        audio.onended = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            setPlayFraction(-1);
            if (canvasRef.current) {
                drawStaticBars(canvasRef.current, ampsRef.current, -1);
            }
        };
        audio.onerror = () => {
            console.warn("[VoiceMessageBubble] Audio error for", message.mediaUrl);
        };

        return () => {
            audio.pause();
            audio.src = "";
        };
    }, [message.mediaUrl]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().catch(err => console.warn("[VoiceMessageBubble] Play failed:", err));
            setIsPlaying(true);
        }
    };

    const handleCanvasClick = (e) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        audio.currentTime = frac * audio.duration;
    };

    const displayTime = isPlaying ? formatTime(currentTime) : formatTime(duration);

    return (
        <div className="voice-message-bubble">
            <button
                className="voice-play-btn"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
            >
                {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                )}
            </button>
            <canvas
                ref={canvasRef}
                className="voice-waveform-canvas"
                width={canvasWidth}
                height={CANVAS_HEIGHT}
                onClick={handleCanvasClick}
                style={{ cursor: "pointer" }}
                aria-label="Voice message waveform"
            />
            <span className="voice-duration">{displayTime}</span>
        </div>
    );
};

export default VoiceMessageBubble;
