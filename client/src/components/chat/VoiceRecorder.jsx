import { useState, useRef, useEffect, useCallback } from "react";
import { getAudioContext, playVoiceStartTone, playVoiceStopTone } from "../../utils/audio";

const MAX_DURATION_S = 120; // 2 minutes
const MIN_HOLD_MS = 500;
const BARS = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const CANVAS_HEIGHT = 32;
const WARNING_AT_S = 105; // 15s before end

// Extracts amplitude snapshot from a recorded Blob — returns base64 string
const extractWaveform = async (blob) => {
    try {
        const arrayBuf = await blob.arrayBuffer();
        const offlineCtx = new OfflineAudioContext(1, 1, 44100);
        const decoded = await offlineCtx.decodeAudioData(arrayBuf);
        const data = decoded.getChannelData(0);
        const blockSize = Math.floor(data.length / BARS);
        const bars = [];
        for (let i = 0; i < BARS; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(data[i * blockSize + j]);
            }
            bars.push(sum / blockSize);
        }
        const max = Math.max(...bars, 0.001);
        const normalized = bars.map(v => Math.round((v / max) * 255));
        return btoa(String.fromCharCode(...normalized));
    } catch (err) {
        console.warn("[VoiceRecorder] Waveform extraction failed:", err);
        return "";
    }
};

const drawBars = (canvas, amplitudes, playedFraction = -1, isLive = true) => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const totalBars = amplitudes.length || BARS;
    const centerY = canvas.height / 2;

    for (let i = 0; i < totalBars; i++) {
        const amp = isLive ? amplitudes[i] ?? 0 : amplitudes[i] ?? 0;
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

const VoiceRecorder = ({ onSend, onCancel, isMobile }) => {
    const [mode, setMode] = useState("idle"); // idle | recording | preview
    const [isLocked, setIsLocked] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [previewDuration, setPreviewDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playFraction, setPlayFraction] = useState(-1);

    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const micBtnRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const analyserRef = useRef(null);
    const animFrameRef = useRef(null);
    const startTimeRef = useRef(null);
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

    // Acquire wake lock
    const acquireWakeLock = async () => {
        try {
            if ("wakeLock" in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request("screen");
            }
        } catch (_) {}
    };

    const releaseWakeLock = () => {
        try {
            wakeLockRef.current?.release();
            wakeLockRef.current = null;
        } catch (_) {}
    };

    // Re-acquire wake lock if page becomes visible again while recording
    useEffect(() => {
        const handler = async () => {
            if (document.visibilityState === "visible" && mode === "recording") {
                await acquireWakeLock();
            }
        };
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, [mode]);

    const startRecording = useCallback(async () => {
        if (mode === "recording") return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioCtx = getAudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            analyserRef.current = analyser;

            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/webm";
            const recorder = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(chunksRef.current, { type: mimeType });
                blobRef.current = blob;
                const wf = await extractWaveform(blob);
                waveformBase64Ref.current = wf;
            };
            recorder.start(100);
            mediaRecorderRef.current = recorder;

            await acquireWakeLock();
            playVoiceStartTone();
            startTimeRef.current = Date.now();
            elapsedRef.current = 0;
            setElapsed(0);
            setMode("recording");

            // Tick timer every second
            timerRef.current = setInterval(() => {
                const s = Math.round((Date.now() - startTimeRef.current) / 1000);
                elapsedRef.current = s;
                setElapsed(s);
            }, 500);

            // Auto-stop at 2 minutes
            autoStopRef.current = setTimeout(() => {
                stopRecording(true);
            }, MAX_DURATION_S * 1000);

            // Live waveform animation
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                analyser.getByteFrequencyData(freqData);
                const step = Math.floor(freqData.length / BARS);
                const amps = [];
                for (let i = 0; i < BARS; i++) {
                    amps.push(freqData[i * step] / 255);
                }
                liveAmpsRef.current = amps;

                if (canvasRef.current) {
                    // Warning tint: linear interp from 0 to 0.10 over last 15s
                    const elapsed = elapsedRef.current;
                    if (elapsed >= WARNING_AT_S && wrapRef.current) {
                        const progress = (elapsed - WARNING_AT_S) / (MAX_DURATION_S - WARNING_AT_S);
                        const alpha = Math.min(progress * 0.10, 0.10).toFixed(3);
                        wrapRef.current.style.background = `rgba(239,68,68,${alpha})`;
                    }
                    drawBars(canvasRef.current, amps, -1, true);
                }
                animFrameRef.current = requestAnimationFrame(tick);
            };
            animFrameRef.current = requestAnimationFrame(tick);
        } catch (err) {
            console.error("[VoiceRecorder] getUserMedia failed:", err);
        }
    }, [mode]);

    const stopRecording = useCallback((autoSend = false) => {
        clearInterval(timerRef.current);
        clearTimeout(autoStopRef.current);
        cancelAnimationFrame(animFrameRef.current);
        releaseWakeLock();

        const finalElapsed = elapsedRef.current;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }

        playVoiceStopTone();

        if (autoSend) {
            // Wait briefly for onstop to populate blob
            setTimeout(() => {
                if (blobRef.current) {
                    onSend(blobRef.current, finalElapsed, waveformBase64Ref.current);
                }
            }, 150);
        } else {
            setPreviewDuration(finalElapsed);
            // Draw static preview waveform after blob is ready
            setTimeout(() => {
                if (canvasRef.current && liveAmpsRef.current) {
                    drawBars(canvasRef.current, liveAmpsRef.current, -1, false);
                }
            }, 100);
            setMode("preview");
            if (wrapRef.current) wrapRef.current.style.background = "";
        }
    }, [onSend]);

    const handleSend = () => {
        if (blobRef.current) {
            onSend(blobRef.current, previewDuration, waveformBase64Ref.current);
        }
    };

    const handleDiscard = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setMode("idle");
        setIsLocked(false);
        setElapsed(0);
        setPlayFraction(-1);
        blobRef.current = null;
        waveformBase64Ref.current = "";
        if (wrapRef.current) wrapRef.current.style.background = "";
        onCancel();
    };

    const togglePreviewPlayback = () => {
        if (!blobRef.current) return;
        if (!audioRef.current) {
            audioRef.current = new Audio(URL.createObjectURL(blobRef.current));
            audioRef.current.ontimeupdate = () => {
                const frac = audioRef.current.currentTime / audioRef.current.duration;
                setPlayFraction(frac);
                if (canvasRef.current) {
                    drawBars(canvasRef.current, liveAmpsRef.current, frac, false);
                }
            };
            audioRef.current.onended = () => {
                setIsPlaying(false);
                setPlayFraction(-1);
                if (canvasRef.current) drawBars(canvasRef.current, liveAmpsRef.current, -1, false);
            };
        }
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    // Desktop spacebar: hold-to-send when textarea is not focused and input is empty
    useEffect(() => {
        let spaceHeld = false;
        const onKeyDown = (e) => {
            if (e.code !== "Space" || e.repeat) return;
            const active = document.activeElement;
            if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return;
            if (mode !== "idle" && mode !== "recording") return;
            e.preventDefault();
            if (!spaceHeld) {
                spaceHeld = true;
                holdStartRef.current = Date.now();
                isHoldModeRef.current = true;
                startRecording();
            }
        };
        const onKeyUp = (e) => {
            if (e.code !== "Space") return;
            if (!spaceHeld) return;
            spaceHeld = false;
            if (!isHoldModeRef.current) return;
            const held = Date.now() - (holdStartRef.current || 0);
            if (held < MIN_HOLD_MS) {
                // Too short — discard silently
                stopRecording(false);
                setTimeout(() => handleDiscard(), 160);
                return;
            }
            stopRecording(true);
            isHoldModeRef.current = false;
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [mode, startRecording, stopRecording]);

    // Mobile: pointer events on mic button for hold-to-send + swipe-to-lock
    const handlePointerDown = (e) => {
        if (!isMobile) return;
        if (mode === "preview") return;
        holdStartRef.current = Date.now();
        isHoldModeRef.current = true;
        touchStartYRef.current = e.clientY;
        if (mode === "idle") startRecording();
    };

    const handlePointerMove = (e) => {
        if (!isMobile || !isHoldModeRef.current || mode !== "recording") return;
        const deltaY = touchStartYRef.current - e.clientY;
        if (deltaY > 60) {
            // Swipe up: lock into click mode
            isHoldModeRef.current = false;
            setIsLocked(true);
        }
    };

    const handlePointerUp = () => {
        if (!isMobile) return;
        if (isLocked || !isHoldModeRef.current) return;
        const held = Date.now() - (holdStartRef.current || 0);
        isHoldModeRef.current = false;
        if (mode === "recording") {
            if (held < MIN_HOLD_MS) {
                stopRecording(false);
                setTimeout(() => handleDiscard(), 160);
            } else {
                stopRecording(true);
            }
        }
    };

    // Tap in locked/click mode to stop
    const handleMicClick = () => {
        if (isMobile && isHoldModeRef.current) return; // handled by pointer events
        if (mode === "idle") {
            isHoldModeRef.current = false;
            startRecording();
        } else if (mode === "recording" && (isLocked || !isMobile)) {
            stopRecording(false);
        }
    };

    const isWarning = elapsed >= WARNING_AT_S;
    const canvasWidth = BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

    if (mode === "idle") {
        return (
            <button
                ref={micBtnRef}
                className={`voice-mic-btn${mode === "recording" ? " recording" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={handleMicClick}
                title={isMobile ? "Hold to record" : "Click or hold Space to record"}
                aria-label="Record voice message"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
            </button>
        );
    }

    return (
        <div className="voice-recorder-wrap">
            {mode === "recording" && isMobile && isLocked && (
                <div className="voice-lock-indicator" title="Locked — tap mic to stop">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l-5 9h10L12 2z"/></svg>
                </div>
            )}

            {mode === "preview" && (
                <button
                    className="voice-action-btn"
                    onClick={togglePreviewPlayback}
                    aria-label={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                </button>
            )}

            <div
                ref={wrapRef}
                className="voice-waveform-wrap"
                style={{ transition: "background 0.5s ease" }}
            >
                <canvas
                    ref={canvasRef}
                    className="voice-waveform-canvas"
                    width={canvasWidth}
                    height={CANVAS_HEIGHT}
                    onClick={mode === "preview" ? togglePreviewPlayback : undefined}
                    style={{ cursor: mode === "preview" ? "pointer" : "default" }}
                />
            </div>

            <span className={`voice-duration${isWarning ? " warning" : ""}`}>
                {mode === "recording" ? formatTime(elapsed) : formatTime(previewDuration)}
            </span>

            {mode === "recording" && (
                <button
                    ref={micBtnRef}
                    className="voice-mic-btn recording"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={handleMicClick}
                    aria-label="Stop recording"
                    title="Stop recording"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                </button>
            )}

            {mode === "preview" && (
                <div className="voice-action-row">
                    <button className="voice-action-btn discard" onClick={handleDiscard} title="Discard" aria-label="Discard recording">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <button className="voice-action-btn send" onClick={handleSend} title="Send voice message" aria-label="Send voice message">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default VoiceRecorder;
