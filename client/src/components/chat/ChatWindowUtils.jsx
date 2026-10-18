import { useState, useRef, useCallback, memo } from "react";
import { getAudioContext, setRecordingDestination } from "../../utils/audio";

export const EMPTY_MESSAGES = [];
export const EMPTY_CONTACTS = [];

const mysteryQuotes = [
    "Status: Classified",
    "Maybe online... Or not?",
    "Nobody knows the presence...",
    "Selectively visible"
];

export const getMysteryQuote = (userId) => {
    if (!userId) return mysteryQuotes[0];
    const hash = Array.from(userId.toString()).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const epoch12h = Math.floor(Date.now() / (12 * 60 * 60 * 1000));
    return mysteryQuotes[(hash + epoch12h) % mysteryQuotes.length];
};

export const OnlineDot = memo(({ isSPOp }) => {
    const [tooltip, setTooltip] = useState(null);
    const dotRef = useRef(null);

    const showTooltip = useCallback(() => {
        if (!dotRef.current) return;
        const rect = dotRef.current.getBoundingClientRect();
        setTooltip({ x: rect.right + 6, y: rect.top + rect.height / 2 });
    }, []);

    const hideTooltip = useCallback(() => setTooltip(null), []);

    return (
        <>
            <span
                ref={dotRef}
                className={`online-dot${isSPOp ? ' online-dot--amber' : ''}`}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onClick={e => { e.stopPropagation(); tooltip ? hideTooltip() : showTooltip(); }}
            />
            {tooltip && (
                <span
                    className="online-dot-tooltip"
                    style={{ left: tooltip.x, top: tooltip.y, transform: 'translateY(-50%)' }}
                >
                    {isSPOp ? 'Online (unstable connection)' : 'Online'}
                </span>
            )}
        </>
    );
});



export const ScrollDownBtn = ({ onClick, show, isLifted, unreadCount }) => (
    <button
        className={`scroll-down-btn ${show ? 'visible' : ''}`}
        style={{ marginBottom: isLifted ? '54px' : '0', transition: 'margin-bottom 0.2s ease-out' }}
        onClick={onClick}
        aria-label="Scroll to bottom"
    >
        {unreadCount > 0 ? (
            <span className="unread-scroll-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 13 12 18 17 13" />
                <polyline points="7 6 12 11 17 6" />
            </svg>
        )}
    </button>
);

export const MODE_LABELS = {
    instant: 'going offline',
    '1h': '1 hour',
    '8h': '8 hours',
    '24h': '1 day',
    '7d': '7 days',
};

export const DisappearingBanner = memo(({ mode, onDisable }) => {
    const lastTapRef = useRef(0);

    const handleDoubleClick = () => onDisable();

    // Mobile double-tap detection (no native dblclick on touch)
    const handleTouchEnd = (e) => {
        const now = Date.now();
        if (now - lastTapRef.current < 350) {
            e.preventDefault();
            onDisable();
        }
        lastTapRef.current = now;
    };

    return (
        <div
            onDoubleClick={handleDoubleClick}
            onTouchEnd={handleTouchEnd}
            title="Double-tap to turn off disappearing messages"
            style={{
                padding: '7px 14px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderTop: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                color: '#60a5fa',
                fontSize: '0.78rem',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
        >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>
                Disappearing messages ON - disappear after <strong>{MODE_LABELS[mode] || mode}</strong>.
                &nbsp;<span style={{ opacity: 0.6, fontSize: '0.72rem' }}>Double-tap to turn off</span>
            </span>
        </div>
    );
});



export const DELETED_PHRASES = [
    "This warm spot became a cold void - never to be filled again.",
    "Another star, you fade away...",
    "Where are you now? Was it all in my fantasy?",
    "Where are you now? Were you only imaginary?",
    "Every day wandering towards our North star, guess we got lost in the night...",
    "I wish you were around, but now it's too late...",
    "Ooh, ooh, ooh, ooh - Birds fly in different directions...",
    "Time doesn't hear if you ask it to wait",
    "Wish we could turn back time, to the good old days..."
];

export const ZenParticleCanvas = memo(({ phase, noiseElements }) => {
    const canvasRef = useRef(null);
    const phaseRef = useRef(phase);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const startTimeRef = useRef(null);
    const implosionStartRef = useRef(null);
    const bloomStartRef = useRef(null);
    const modeNameStartRef = useRef(null);

    useEffect(() => {
        phaseRef.current = phase;
        if (phase === "noise") {
            startTimeRef.current = Date.now();
        } else if (phase === "implosion") {
            implosionStartRef.current = Date.now();
        } else if (phase === "bloom") {
            bloomStartRef.current = Date.now();
        } else if (phase === "mode-name") {
            modeNameStartRef.current = Date.now();
        }
    }, [phase]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let animationFrameId;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        const particles = [];
        for (let i = 0; i < 40; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height + canvas.height,
                size: Math.random() * 2 + 0.5,
                speedY: -(Math.random() * 0.8 + 0.2),
                opacity: Math.random() * 0.5 + 0.1,
                oscSpeed: Math.random() * 0.02,
                oscVal: Math.random() * Math.PI
            });
        }

        let recorder = null;
        let audioDest = null;

        const startRecording = () => {
            try {
                const audioCtx = getAudioContext();
                if (!audioCtx) return;

                audioDest = audioCtx.createMediaStreamDestination();
                setRecordingDestination(audioDest);

                const canvasStream = canvas.captureStream(60);
                const audioTrack = audioDest.stream.getAudioTracks()[0];
                if (audioTrack) {
                    canvasStream.addTrack(audioTrack);
                }

                chunksRef.current = [];
                recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9,opus' });
                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        chunksRef.current.push(e.data);
                    }
                };

                recorder.onstop = () => {
                    if (chunksRef.current.length === 0) return;
                    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "zen_cinematic.webm";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    setRecordingDestination(null);
                };

                mediaRecorderRef.current = recorder;
                recorder.start();
                console.log("Zen Mode Cinematic Video Recording Started (Option A).");
            } catch (err) {
                console.warn("Failed to initialize MediaRecorder:", err);
            }
        };

        const stopRecording = () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                try {
                    mediaRecorderRef.current.stop();
                    console.log("Zen Mode Cinematic Video Recording Completed and Saved.");
                } catch (err) {
                    console.error("Failed to stop MediaRecorder:", err);
                }
                mediaRecorderRef.current = null;
            }
        };

        const animate = () => {
            const currentPhase = phaseRef.current;
            const now = Date.now();

            if (currentPhase === "noise" && !mediaRecorderRef.current) {
                startRecording();
            }
            if (currentPhase === "integration" && mediaRecorderRef.current) {
                stopRecording();
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.y += p.speedY;
                p.oscVal += p.oscSpeed;
                p.x += Math.sin(p.oscVal) * 0.3;
                if (p.y < -10) {
                    p.y = canvas.height + 10;
                    p.x = Math.random() * canvas.width;
                }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
                ctx.shadowBlur = p.size * 2;
                ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
                ctx.fill();
            });

            if (currentPhase === "disclaimer") {
                ctx.save();
                ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
                ctx.font = "15px system-ui, -apple-system, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const text = "For the immersive experience, turn your device volume up.";
                const words = text.split(" ");
                let line = "";
                const lines = [];
                const maxWidth = Math.min(canvas.width - 48, 380); // padding on sides in mobile

                for (let n = 0; n < words.length; n++) {
                    let testLine = line + words[n] + " ";
                    let metrics = ctx.measureText(testLine);
                    let testWidth = metrics.width;
                    if (testWidth > maxWidth && n > 0) {
                        lines.push(line.trim());
                        line = words[n] + " ";
                    } else {
                        line = testLine;
                    }
                }
                lines.push(line.trim());

                // Draw lines centered
                const lineHeight = 22;
                const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
                lines.forEach((lineText, lIdx) => {
                    ctx.fillText(lineText, canvas.width / 2, startY + lIdx * lineHeight);
                });

                ctx.restore();
            } else if (currentPhase === "noise" || currentPhase === "implosion") {
                const isImploding = currentPhase === "implosion";
                const implosionElapsed = implosionStartRef.current ? now - implosionStartRef.current : 0;

                if (noiseElements && noiseElements.length > 0) {
                    noiseElements.forEach((el) => {
                        ctx.save();
                        let cx = (el.x / 100) * canvas.width;
                        let cy = (el.y / 100) * canvas.height;
                        let scale = el.scale;
                        let opacity = 0.45;

                        if (isImploding) {
                            const targetX = canvas.width / 2;
                            const targetY = canvas.height / 2;

                            // Stagger the suck-in start based on each card's unique random delay!
                            const cardProgress = Math.min(1, Math.max(0, (implosionElapsed - el.delay * 1000) / 1600));

                            // High-end dramatic cubic ease-in formula: accelerates near the gravity well center!
                            const easeProgress = Math.pow(cardProgress, 3.5);

                            // Random rotational spiral orbital whirlpool path!
                            const angleOffset = (1 - easeProgress) * el.rot * 0.15;
                            const dx = cx - targetX;
                            const dy = cy - targetY;
                            const currentDist = Math.sqrt(dx * dx + dy * dy) * (1 - easeProgress);
                            const currentAngle = Math.atan2(dy, dx) + angleOffset;

                            cx = targetX + Math.cos(currentAngle) * currentDist;
                            cy = targetY + Math.sin(currentAngle) * currentDist;
                            scale = scale * (1 - easeProgress);
                            opacity = 0.45 * (1 - easeProgress);
                        }

                        ctx.translate(cx, cy);
                        ctx.rotate((el.rot * Math.PI) / 180);
                        ctx.scale(scale, scale);

                        const textWidth = ctx.measureText(el.text).width + 36;
                        const w = textWidth;
                        const h = 32;

                        ctx.fillStyle = el.isMine ? "rgba(61, 165, 217, 0.12)" : "rgba(255, 255, 255, 0.05)";
                        ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
                        ctx.lineWidth = 1;

                        ctx.beginPath();
                        ctx.roundRect(-w / 2, -h / 2, w, h, 8);
                        ctx.fill();
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(-w / 2 + 12, 0, 6, 0, Math.PI * 2);
                        ctx.fillStyle = el.isMine ? "#3da5d9" : "rgba(255,255,255,0.2)";
                        ctx.fill();

                        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 1.5})`;
                        ctx.font = "11px system-ui, -apple-system, sans-serif";
                        ctx.textAlign = "left";
                        ctx.textBaseline = "middle";
                        ctx.fillText(el.text, -w / 2 + 24, 0);

                        ctx.restore();
                    });
                }

                // Radiant glowing gravitational singularity core in the center of the screen
                if (isImploding) {
                    ctx.save();
                    const pulse = Math.sin(now * 0.008) * 4 + 8; // radius pulsates between 4px and 12px
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;

                    // Large glowing gradient aura around the core
                    const auraGrad = ctx.createRadialGradient(
                        centerX, centerY, 0,
                        centerX, centerY, pulse * 4
                    );
                    auraGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
                    auraGrad.addColorStop(0.25, "rgba(61, 165, 217, 0.95)");
                    auraGrad.addColorStop(0.6, "rgba(61, 165, 217, 0.4)");
                    auraGrad.addColorStop(1, "rgba(61, 165, 217, 0)");

                    ctx.fillStyle = auraGrad;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, pulse * 4, 0, Math.PI * 2);
                    ctx.fill();

                    // Bright hot focus point inside
                    ctx.fillStyle = "#ffffff";
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = "#3da5d9";
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Shake / Stop-Motion Jitter typography for "THE NOISE IS LOUD." text
                const textOpacity = currentPhase === "noise"
                    ? 0.9
                    : Math.max(0, 0.9 * (1 - implosionElapsed / 1000)); // Fades out completely in 1 second during implosion

                if (textOpacity > 0) {
                    ctx.save();
                    ctx.font = "bold 28px Georgia, serif";
                    ctx.textAlign = "left";
                    ctx.textBaseline = "middle";

                    const textStr = "THE NOISE IS LOUD.";
                    const charArray = textStr.split("");

                    // Pre-measure total width to center the shaky stop-motion text
                    let totalWidth = 0;
                    const charWidths = charArray.map(c => {
                        const w = ctx.measureText(c).width;
                        totalWidth += w;
                        return w;
                    });

                    let startX = canvas.width / 2 - totalWidth / 2;
                    const centerY = canvas.height / 2;

                    // Stop-motion frame jitter step (updates 10 times a second)
                    const jitterSeed = Math.floor(now / 100);

                    charArray.forEach((char, charIdx) => {
                        ctx.save();
                        // Deterministic pseudorandom noise per character based on index & stop-motion seed
                        const seedX = Math.sin(charIdx * 17.3 + jitterSeed * 4.9) * 43758.5453;
                        const seedY = Math.cos(charIdx * 9.2 + jitterSeed * 7.4) * 12345.6789;
                        const seedR = Math.sin(charIdx * 23.5 + jitterSeed * 11.2) * 98765.4321;

                        const jitterX = (seedX - Math.floor(seedX)) * 3.5 - 1.75; // [-1.75px, 1.75px]
                        const jitterY = (seedY - Math.floor(seedY)) * 3.5 - 1.75; // [-1.75px, 1.75px]
                        const jitterAngle = ((seedR - Math.floor(seedR)) * 6.5 - 3.25) * Math.PI / 180; // [-3.25deg, 3.25deg]

                        const charW = charWidths[charIdx];
                        const charCX = startX + charW / 2;

                        ctx.translate(charCX + jitterX, centerY + jitterY);
                        ctx.rotate(jitterAngle);

                        ctx.fillStyle = `rgba(255, 255, 255, ${textOpacity})`;
                        ctx.fillText(char, -charW / 2, 0);

                        ctx.restore();
                        startX += charW;
                    });

                    ctx.restore();
                }
            } else if (currentPhase === "bloom") {
                const bloomElapsed = bloomStartRef.current ? now - bloomStartRef.current : 0;
                ctx.save();
                ctx.font = "italic 28px Georgia, serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const w1Opacity = Math.min(1, Math.max(0, (bloomElapsed - 400) / 1000));
                ctx.fillStyle = `rgba(255, 255, 255, ${w1Opacity * 0.9})`;
                ctx.fillText("Quiet", canvas.width / 2, canvas.height / 2 - 40);

                const w2Opacity = Math.min(1, Math.max(0, (bloomElapsed - 900) / 1000));
                ctx.fillStyle = `rgba(255, 255, 255, ${w2Opacity * 0.9})`;
                ctx.fillText("the", canvas.width / 2, canvas.height / 2);

                const w3Opacity = Math.min(1, Math.max(0, (bloomElapsed - 1400) / 1000));
                ctx.fillStyle = `rgba(255, 255, 255, ${w3Opacity * 0.9})`;
                ctx.fillText("mind.", canvas.width / 2, canvas.height / 2 + 40);
                ctx.restore();
            } else if (currentPhase === "mode-name") {
                const modeNameElapsed = modeNameStartRef.current ? now - modeNameStartRef.current : 0;
                // Beautiful sine curve over the entire 2500ms duration for perfect fade in and out!
                const progress = Math.min(1, Math.max(0, modeNameElapsed / 2500));
                const opacity = Math.sin(progress * Math.PI);

                ctx.save();
                ctx.fillStyle = `rgba(61, 165, 217, ${opacity})`;
                ctx.font = "300 36px 'Outfit', 'Inter', 'Segoe UI', sans-serif";
                ctx.letterSpacing = "8px"; // Spaced out futuristic font!
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("#ZenMode.", canvas.width / 2, canvas.height / 2);
                ctx.restore();
            }

            animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            cancelAnimationFrame(animationFrameId);
            stopRecording();
        };
    }, [noiseElements]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 1
            }}
        />
    );
});


