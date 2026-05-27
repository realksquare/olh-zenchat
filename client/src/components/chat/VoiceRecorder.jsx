import { useState, useRef, useEffect, useCallback } from "react";
import { getAudioContext, playVoiceStartTone, playVoiceStopTone } from "../../utils/audio";

const MAX_DURATION_S = 120; // 2 minutes
const MIN_HOLD_MS = 500;
const BARS = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const CANVAS_HEIGHT = 32;
const WARNING_AT_S = 105; // 15 s before end

// ── Waveform Extraction ──────────────────────────────────────────────────────
// Uses online AudioContext (not OfflineAudioContext) — compatible with webm/opus
const generateFallbackWaveform = (blobSize) => {
    const bars = [];
    for (let i = 0; i < BARS; i++) {
        const seed = Math.sin(i * 17.3 + blobSize * 0.0001) * 43758.5453;
        const rand = Math.abs(seed - Math.floor(seed));
        const envelope = 0.3 + 0.7 * Math.sin((i / BARS) * Math.PI);
        bars.push(Math.round((0.2 + rand * 0.8) * envelope * 255));
    }
    return btoa(String.fromCharCode(...bars));
};

const extractWaveform = async (blob) => {
    try {
        const arrayBuf = await blob.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        const data = decoded.getChannelData(0);
        const blockSize = Math.floor(data.length / BARS);
        const bars = [];
        for (let i = 0; i < BARS; i++) {
            let sum = 0;
            const start = i * blockSize;
            for (let j = 0; j < blockSize; j++) sum += Math.abs(data[start + j] || 0);
            bars.push(sum / (blockSize || 1));
        }
        const max = Math.max(...bars, 0.001);
        const normalized = bars.map(v => Math.round((v / max) * 255));
        audioCtx.close().catch(() => {});
        return btoa(String.fromCharCode(...normalized));
    } catch (err) {
        console.warn("[VoiceRecorder] Waveform extraction failed, using fallback:", err.message);
        return generateFallbackWaveform(blob.size);
    }
};

// ── Canvas Helpers ────────────────────────────────────────────────────────────
const drawBars = (canvas, amplitudes, playedFraction = -1) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const totalBars = (amplitudes && amplitudes.length) ? amplitudes.length : BARS;
    const centerY = canvas.height / 2;
    for (let i = 0; i < totalBars; i++) {
        const amp = amplitudes ? (amplitudes[i] ?? 0) : 0.3;
        const barH = Math.max(3, Math.round(amp * CANVAS_HEIGHT * 0.85));
        const x = i * (BAR_WIDTH + BAR_GAP);
        const isPlayed = playedFraction >= 0 && i / totalBars <= playedFraction;
        ctx.fillStyle = isPlayed ? "#3da5d9" : "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.roundRect(x, centerY - barH / 2, BAR_WIDTH, barH, 1.5);
        ctx.fill();
    }
};

const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
};

const CANVAS_WIDTH = BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

// ── Component ─────────────────────────────────────────────────────────────────
const VoiceRecorder = ({ onSend, onCancel, isMobile, onModeChange }) => {
    const [mode, setMode] = useState("idle"); // idle | recording | preview
    const [isLocked, setIsLocked] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [previewDuration, setPreviewDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // ── Refs (stable across renders, safe in async callbacks) ─────────────────
    const modeRef = useRef("idle");
    const isLockedRef = useRef(false);
    const onModeChangeRef = useRef(onModeChange);
    const onSendRef = useRef(onSend);
    const onCancelRef = useRef(onCancel);
    useEffect(() => { onModeChangeRef.current = onModeChange; }, [onModeChange]);
    useEffect(() => { onSendRef.current = onSend; }, [onSend]);
    useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
    useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

    const streamRef = useRef(null);
    const pendingStopRef = useRef(null);
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const analyserRef = useRef(null);
    const animFrameRef = useRef(null);
    const startTimeRef = useRef(null); // Set AFTER recorder.start() — actual recording time
    const holdStartRef = useRef(null);
    const timerRef = useRef(null);
    const autoStopRef = useRef(null);
    const wakeLockRef = useRef(null);
    const blobRef = useRef(null);
    const waveformBase64Ref = useRef("");
    const audioRef = useRef(null);
    const elapsedRef = useRef(0);
    const liveAmpsRef = useRef(new Array(BARS).fill(0));
    const touchStartYRef = useRef(null);
    const isHoldModeRef = useRef(false);

    // ── Stable mode setter — uses refs so useCallbacks don't go stale ─────────
    const setModeSync = useCallback((m) => {
        modeRef.current = m;
        setMode(m);
        onModeChangeRef.current?.(m);
    }, []);

    // ── Wake Lock ──────────────────────────────────────────────────────────────
    const acquireWakeLock = useCallback(async () => {
        try {
            if ("wakeLock" in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request("screen");
            }
        } catch (_) {}
    }, []);

    const releaseWakeLock = useCallback(() => {
        try { wakeLockRef.current?.release(); wakeLockRef.current = null; } catch (_) {}
    }, []);

    useEffect(() => {
        const handler = async () => {
            if (document.visibilityState === "visible" && modeRef.current === "recording") {
                await acquireWakeLock();
            }
        };
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, [acquireWakeLock]);

    // ── Full cleanup on unmount ────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
            clearTimeout(autoStopRef.current);
            cancelAnimationFrame(animFrameRef.current);
            releaseWakeLock();
            const rec = mediaRecorderRef.current;
            if (rec && rec.state !== "inactive") {
                rec.onstop = null; // Prevent stale callback from firing
                try { rec.stop(); } catch (_) {}
            }
            const stream = streamRef.current;
            if (stream) {
                try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
                streamRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            // Reset parent voiceActive status when unmounting
            onModeChangeRef.current?.("idle");
        };
    }, [releaseWakeLock]);

    // ── Core: stopRecording — always sets onstop BEFORE calling stop() ─────────
    // sendMode: 'send' | 'preview' | 'discard'
    const stopRecording = useCallback((sendMode) => {
        clearInterval(timerRef.current);
        clearTimeout(autoStopRef.current);
        cancelAnimationFrame(animFrameRef.current);
        releaseWakeLock();

        if (wrapRef.current) wrapRef.current.style.background = "";

        const recorder = mediaRecorderRef.current;
        const finalElapsed = elapsedRef.current;
        const capturedAmps = [...liveAmpsRef.current];

        if (!recorder || recorder.state === "inactive") {
            const stream = streamRef.current;
            if (stream) {
                try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
                streamRef.current = null;
            }
            // No active recorder — just reset state
            if (sendMode === "discard") {
                blobRef.current = null;
                waveformBase64Ref.current = "";
                setModeSync("idle");
                setElapsed(0);
                setIsLocked(false);
                isHoldModeRef.current = false;
                onCancelRef.current?.();
            } else if (sendMode === "preview" && blobRef.current) {
                // Already have a blob (shouldn't happen often)
                setModeSync("preview");
            }
            mediaRecorderRef.current = null;
            return;
        }

        // ⚠️ Set onstop BEFORE calling stop() to avoid race condition
        recorder.onstop = async () => {
            const stream = streamRef.current;
            if (stream) {
                try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
                streamRef.current = null;
            }
            const mimeType = recorder.mimeType || "audio/webm";
            const blob = new Blob(chunksRef.current, { type: mimeType });

            if (sendMode === "send") {
                if (!blob.size) {
                    // Nothing recorded (e.g. micro-tap) — discard silently
                    setModeSync("idle"); setElapsed(0); setIsLocked(false); isHoldModeRef.current = false;
                } else {
                    const wf = await extractWaveform(blob);
                    // Call onSend, then immediately reset — prevents phantom re-sends
                    onSendRef.current?.(blob, finalElapsed, wf);
                    blobRef.current = null;
                    waveformBase64Ref.current = "";
                    setModeSync("idle");
                    setElapsed(0);
                    setIsLocked(false);
                    isHoldModeRef.current = false;
                }

            } else if (sendMode === "preview") {
                blobRef.current = blob;
                const wf = await extractWaveform(blob);
                waveformBase64Ref.current = wf;
                setPreviewDuration(finalElapsed);
                // Draw static waveform from the live amplitude snapshot
                requestAnimationFrame(() => {
                    if (canvasRef.current) drawBars(canvasRef.current, capturedAmps, -1);
                });
                setModeSync("preview");

            } else {
                // discard
                blobRef.current = null;
                waveformBase64Ref.current = "";
                setModeSync("idle");
                setElapsed(0);
                setIsLocked(false);
                isHoldModeRef.current = false;
                onCancelRef.current?.();
            }

            mediaRecorderRef.current = null;
        };

        playVoiceStopTone();
        try { recorder.stop(); } catch (_) {}
    }, [setModeSync, releaseWakeLock]);

    // ── startRecording ────────────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        if (modeRef.current === "recording") return;
        pendingStopRef.current = null;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (pendingStopRef.current) {
                // Key/pointer was released while permission was loading
                try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
                pendingStopRef.current = null;
                return;
            }
            streamRef.current = stream;

            const audioCtx = getAudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            analyserRef.current = analyser;

            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                    ? "audio/webm"
                    : "";
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.start(200);
            mediaRecorderRef.current = recorder;

            startTimeRef.current = Date.now();
            elapsedRef.current = 0;
            setElapsed(0);
            setModeSync("recording");

            if (pendingStopRef.current) {
                const stopMode = pendingStopRef.current;
                pendingStopRef.current = null;
                stopRecording(stopMode);
                return;
            }

            await acquireWakeLock();
            playVoiceStartTone();

            // Timer tick every 500 ms
            timerRef.current = setInterval(() => {
                const s = Math.round((Date.now() - startTimeRef.current) / 1000);
                elapsedRef.current = s;
                setElapsed(s);
            }, 500);

            // Auto-stop at 2 minutes — auto-send
            autoStopRef.current = setTimeout(() => {
                if (modeRef.current === "recording") stopRecording("send");
            }, MAX_DURATION_S * 1000);

            // Live waveform animation
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (modeRef.current !== "recording") return;
                analyser.getByteFrequencyData(freqData);
                const step = Math.floor(freqData.length / BARS);
                const amps = [];
                for (let i = 0; i < BARS; i++) amps.push(freqData[i * step] / 255);
                liveAmpsRef.current = amps;

                if (canvasRef.current) {
                    const e = elapsedRef.current;
                    if (e >= WARNING_AT_S && wrapRef.current) {
                        const progress = Math.min((e - WARNING_AT_S) / (MAX_DURATION_S - WARNING_AT_S), 1);
                        wrapRef.current.style.background = `rgba(239,68,68,${(progress * 0.12).toFixed(3)})`;
                    }
                    drawBars(canvasRef.current, amps, -1);
                }
                animFrameRef.current = requestAnimationFrame(tick);
            };
            animFrameRef.current = requestAnimationFrame(tick);

        } catch (err) {
            console.error("[VoiceRecorder] getUserMedia failed:", err);
            setModeSync("idle");
        }
    }, [setModeSync, acquireWakeLock, stopRecording]);

    // ── Desktop: Spacebar hold-to-send ────────────────────────────────────────
    useEffect(() => {
        let spaceHeld = false;
        const onKeyDown = (e) => {
            if (e.code !== "Space" || e.repeat) return;
            const active = document.activeElement;
            if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return;
            if (modeRef.current !== "idle" && modeRef.current !== "recording") return;
            e.preventDefault();
            if (!spaceHeld) {
                spaceHeld = true;
                isHoldModeRef.current = true;
                holdStartRef.current = Date.now();
                if (modeRef.current === "idle") startRecording();
            }
        };
        const onKeyUp = (e) => {
            if (e.code !== "Space" || !spaceHeld) return;
            spaceHeld = false;
            if (!isHoldModeRef.current) return;
            isHoldModeRef.current = false;
            if (modeRef.current !== "recording") {
                pendingStopRef.current = "discard";
                return;
            }
            const actualTime = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
            if (actualTime < MIN_HOLD_MS) {
                stopRecording("discard");
            } else {
                stopRecording("send");
            }
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [startRecording, stopRecording]);

    // ── Mobile: touch hold + swipe-to-lock ───────────────────────────────────
    const handlePointerDown = useCallback((e) => {
        if (!isMobile || modeRef.current === "preview") return;
        e.preventDefault();
        holdStartRef.current = Date.now();
        isHoldModeRef.current = true;
        touchStartYRef.current = e.clientY ?? e.touches?.[0]?.clientY;
        if (modeRef.current === "idle") startRecording();
    }, [isMobile, startRecording]);

    const handlePointerMove = useCallback((e) => {
        if (!isMobile || !isHoldModeRef.current || modeRef.current !== "recording") return;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        const deltaY = (touchStartYRef.current ?? clientY) - clientY;
        if (deltaY > 55) {
            // Swipe up → lock into click mode
            isHoldModeRef.current = false;
            setIsLocked(true);
        }
    }, [isMobile]);

    const handlePointerUp = useCallback(() => {
        if (!isMobile || !isHoldModeRef.current || isLockedRef.current) return;
        isHoldModeRef.current = false;
        if (modeRef.current !== "recording") {
            pendingStopRef.current = "discard";
            return;
        }
        const actualTime = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        if (actualTime < MIN_HOLD_MS) {
            stopRecording("discard");
        } else {
            stopRecording("send");
        }
    }, [isMobile, stopRecording]);

    // ── Desktop click-to-start + locked mobile stop ───────────────────────────
    const handleMicClick = useCallback(() => {
        if (isMobile && isHoldModeRef.current) return; // handled by pointer events
        if (modeRef.current === "idle") {
            isHoldModeRef.current = false;
            startRecording();
        } else if (modeRef.current === "recording" && (isLockedRef.current || !isMobile)) {
            stopRecording("preview");
        }
    }, [isMobile, startRecording, stopRecording]);

    // ── Preview actions ────────────────────────────────────────────────────────
    const handleSend = useCallback(() => {
        if (!blobRef.current) return;
        const blob = blobRef.current;
        const dur = previewDuration;
        const wf = waveformBase64Ref.current;
        // Clear before calling onSend to prevent double-send
        blobRef.current = null;
        waveformBase64Ref.current = "";
        setModeSync("idle");
        setPreviewDuration(0);
        setIsLocked(false);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        onSendRef.current?.(blob, dur, wf);
    }, [previewDuration, setModeSync]);

    const handleDiscard = useCallback(() => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (modeRef.current === "recording") {
            stopRecording("discard");
        } else {
            blobRef.current = null;
            waveformBase64Ref.current = "";
            setModeSync("idle");
            setElapsed(0);
            setPreviewDuration(0);
            setIsLocked(false);
            if (wrapRef.current) wrapRef.current.style.background = "";
            onCancelRef.current?.();
        }
    }, [stopRecording, setModeSync]);

    const togglePreviewPlayback = useCallback(() => {
        if (!blobRef.current) return;
        if (!audioRef.current) {
            const audio = new Audio();
            // Set type explicitly for browser compatibility
            const objUrl = URL.createObjectURL(blobRef.current);
            audio.src = objUrl;
            audioRef.current = audio;
            audio.onended = () => {
                setIsPlaying(false);
                if (canvasRef.current) drawBars(canvasRef.current, liveAmpsRef.current, -1);
            };
            audio.ontimeupdate = () => {
                const frac = audio.duration ? audio.currentTime / audio.duration : 0;
                if (canvasRef.current) drawBars(canvasRef.current, liveAmpsRef.current, frac);
            };
            audio.onerror = () => {
                console.warn("[VoiceRecorder] Preview playback error");
                setIsPlaying(false);
            };
        }
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
        }
    }, [isPlaying]);

    const isWarning = elapsed >= WARNING_AT_S;

    // ── Idle: just the mic button ─────────────────────────────────────────────
    if (mode === "idle") {
        return (
            <button
                className="voice-mic-btn"
                onPointerDown={isMobile ? handlePointerDown : undefined}
                onPointerMove={isMobile ? handlePointerMove : undefined}
                onPointerUp={isMobile ? handlePointerUp : undefined}
                onPointerCancel={isMobile ? handlePointerUp : undefined}
                onClick={!isMobile ? handleMicClick : undefined}
                title={isMobile ? "Hold to record · swipe up to lock" : "Click to record · hold Space"}
                aria-label="Record voice message"
                style={{ touchAction: "none", flexShrink: 0 }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
            </button>
        );
    }

    // ── Recording / Preview ───────────────────────────────────────────────────
    return (
        <div className="voice-recorder-active-wrap">
            {/* Lock indicator */}
            {mode === "recording" && isMobile && isLocked && (
                <span className="voice-lock-indicator" title="Locked — tap to stop">🔒</span>
            )}

            {/* Preview play button */}
            {mode === "preview" && (
                <button className="voice-action-btn" onClick={togglePreviewPlayback} aria-label={isPlaying ? "Pause" : "Play"}>
                    {isPlaying
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    }
                </button>
            )}

            {/* Waveform */}
            <div ref={wrapRef} className="voice-waveform-wrap" style={{ transition: "background 0.5s ease" }}>
                <canvas
                    ref={canvasRef}
                    className="voice-waveform-canvas"
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    onClick={mode === "preview" ? togglePreviewPlayback : undefined}
                    style={{ cursor: mode === "preview" ? "pointer" : "default" }}
                />
            </div>

            {/* Duration */}
            <span className={`voice-duration${isWarning && mode === "recording" ? " warning" : ""}`}>
                {mode === "recording" ? formatTime(elapsed) : formatTime(previewDuration)}
            </span>

            {/* Recording: stop button */}
            {mode === "recording" && (
                <button
                    className="voice-mic-btn recording"
                    onClick={handleMicClick}
                    aria-label="Stop recording"
                    title="Stop recording"
                    style={{ flexShrink: 0 }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                </button>
            )}

            {/* Preview: discard + send */}
            {mode === "preview" && (
                <div className="voice-action-row">
                    <button className="voice-action-btn discard" onClick={handleDiscard} title="Discard" aria-label="Discard recording">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <button className="voice-action-btn send" onClick={handleSend} title="Send voice message" aria-label="Send voice message">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default VoiceRecorder;
