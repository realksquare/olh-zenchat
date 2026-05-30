import { useEffect, useRef, useState, useMemo, memo, useCallback } from "react";
import { createPortal } from "react-dom";

import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import { useSocket } from "../../context/SocketContext";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import { formatDistanceToNow } from "date-fns";
import { VerifiedTick } from "../ui/Icons";
import UserCardModal from "../ui/UserCardModal";
import { useMomentStore } from "../../stores/momentStore";
import MediaViewerModal from "../ui/MediaViewerModal";
import DocViewerModal from "../ui/DocViewerModal";
import MomentViewer from "./MomentViewer";
import axiosInstance from "../../utils/axios";
import { startZenIntroAudio, stopZenIntroAudio, setRecordingDestination, getAudioContext } from "../../utils/audio";

const EMPTY_MESSAGES = [];
const EMPTY_CONTACTS = [];

const OnlineDot = memo(({ isSPOp }) => {
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



const ScrollDownBtn = ({ onClick, show, isLifted }) => (
    <button
        className={`scroll-down-btn ${show ? 'visible' : ''}`}
        style={{ marginBottom: isLifted ? '54px' : '0', transition: 'margin-bottom 0.2s ease-out' }}
        onClick={onClick}
        aria-label="Scroll to bottom"
    >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 13 12 18 17 13" />
            <polyline points="7 6 12 11 17 6" />
        </svg>
    </button>
);

const MODE_LABELS = {
    instant: 'going offline',
    '1h': '1 hour',
    '8h': '8 hours',
    '24h': '1 day',
    '7d': '7 days',
};

const DisappearingBanner = memo(({ mode, onDisable }) => {
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



const DELETED_PHRASES = [
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

const ZenParticleCanvas = memo(({ phase, noiseElements }) => {
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

const ChatWindow = ({ onBack }) => {
    const user = useAuthStore((s) => s.user);
    const contacts = useAuthStore((s) => s.user?.contacts || EMPTY_CONTACTS);
    const {
        activeChat, fetchMessages, fetchOlderMessages, isLoadingMessages, isLoadingOlderMessages,
        typingUsers, voiceRecordingUsers,
        markChatAsRead, onlineUsers, hasMoreMessages, isLowBandwidth, peerLowBandwidth, isOffline,
        isZenMode, toggleZenMode, setZenModeState, zenUsers
    } = useChatStore(useShallow((s) => ({
        activeChat: s.activeChat,
        fetchMessages: s.fetchMessages,
        fetchOlderMessages: s.fetchOlderMessages,
        isLoadingMessages: s.isLoadingMessages,
        isLoadingOlderMessages: s.isLoadingOlderMessages,
        typingUsers: s.typingUsers,
        voiceRecordingUsers: s.voiceRecordingUsers,
        markChatAsRead: s.markChatAsRead,
        onlineUsers: s.onlineUsers,
        hasMoreMessages: s.hasMoreMessages,
        isLowBandwidth: s.isLowBandwidth,
        peerLowBandwidth: s.peerLowBandwidth,
        isOffline: s.isOffline,
        isZenMode: s.isZenMode,
        toggleZenMode: s.toggleZenMode,
        setZenModeState: s.setZenModeState,
        zenUsers: s.zenUsers
    })));

    const hasActiveMoment = useMomentStore((s) => s.hasActiveMoment);

    const [showOnlyStarred, setShowOnlyStarred] = useState(false);
    const rawMessages = useChatStore((s) =>
        activeChat && s.messages[activeChat._id] ? s.messages[activeChat._id] : EMPTY_MESSAGES
    );

    const otherParticipant = useMemo(() => 
        activeChat?.participants?.find((p) => {
            const pid = p?._id?.toString() || p?.toString();
            return pid && pid !== user?._id?.toString();
        }), 
    [activeChat, user?._id]);

    const isDeleted = useMemo(() => {
        if (!activeChat || activeChat.isGroup) return false;
        return !otherParticipant || (typeof otherParticipant === 'string') || !otherParticipant.username;
    }, [activeChat, otherParticipant]);

    const otherUser = isDeleted ? null : otherParticipant;
    const otherUserId = otherUser?._id?.toString() || otherParticipant?._id?.toString() || otherParticipant?.toString();

    const isPeerOnline = useMemo(() => {
        if (!otherUser) return false;
        return !isOffline && !activeChat?.blockStatus?.iBlocked && !activeChat?.blockStatus?.theyBlocked && 
               (otherUser.isOnline || onlineUsers.has(otherUser._id) || onlineUsers.has(otherUser._id?.toString()));
    }, [otherUser, isOffline, activeChat?.blockStatus?.iBlocked, activeChat?.blockStatus?.theyBlocked, onlineUsers]);

    const messages = useMemo(() => {
        const currentUserId = user?._id;
        const sorted = [...rawMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const visible = sorted.filter(m =>
            !m.deletedFor?.some(id => id?.toString() === currentUserId?.toString())
        );
        let result = visible;
        if (showOnlyStarred) {
            result = visible.filter(m => m.starredBy?.includes(user?._id));
        }
        return result;
    }, [rawMessages, showOnlyStarred, user?._id]);

    const { 
        joinChat, 
        leaveChat, 
        markAsRead, 
        deleteMessage, 
        updateLowBandwidth, 
        socket,
        setZenWaitingState,
        startZenTimer,
        showZenToast,
        clearZenTimers,
        setShowExitConfirm,
        hasInitiatedBackRef,
        zenExitTimeoutCountRef
    } = useSocket();
    const messagesEndRef = useRef(null);
    const isLoadingOlderRef = useRef(false);

    useEffect(() => {
        const handleKeyboardOpen = () => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
        };
        window.addEventListener("keyboard-open", handleKeyboardOpen);
        return () => window.removeEventListener("keyboard-open", handleKeyboardOpen);
    }, []);

    const [editingMessage, setEditingMessage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [deletingMessage, setDeletingMessage] = useState(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [showUserCard, setShowUserCard] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [activeViewerMoments, setActiveViewerMoments] = useState(null);
    const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);

    // Multi-select state
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());
    const [showForwardModal, setShowForwardModal] = useState(false);

    // Toast state
    const [localToast, setLocalToast] = useState(null);
    const showToast = useCallback((msg, type = 'info') => {
        setLocalToast({ msg, type });
        setTimeout(() => setLocalToast(null), 3000);
    }, []);

    const [offlineCountdown, setOfflineCountdown] = useState(null);
    const offlineCountdownIntervalRef = useRef(null);

    const clearOfflineTimers = useCallback(() => {
        if (offlineCountdownIntervalRef.current) {
            clearInterval(offlineCountdownIntervalRef.current);
            offlineCountdownIntervalRef.current = null;
        }
    }, []);

    const messagesContainerRef = useRef(null);

    const [revealCircle, setRevealCircle] = useState(null);
    const [cinematicPhase, setCinematicPhase] = useState(null);
    const cinematicTimers = useRef([]);

    const noiseElements = useMemo(() => {
        const bubbles = [
            "What time is the meeting?", "Send me the files", "URGENT!!", "Status update?",
            "omg did you see this?", "hahaha", "missed call", "Server is down!",
            "Ping", "Are you there?", "Wait...", "Hello?"
        ];
        return Array.from({ length: 15 }).map((_, i) => {
            const isMine = i % 2 === 0;
            return {
                id: i,
                text: bubbles[i % bubbles.length],
                isMine,
                x: 15 + Math.random() * 70,
                y: 15 + Math.random() * 70,
                scale: 0.65 + Math.random() * 0.4,
                delay: Math.random() * 0.4,
                rot: -12 + Math.random() * 24
            };
        });
    }, []);

    const clearCinematicTimers = useCallback(() => {
        cinematicTimers.current.forEach(t => clearTimeout(t));
        cinematicTimers.current = [];
    }, []);

    const triggerCircularReveal = useCallback((x, y, nextZenState) => {
        setRevealCircle({ x, y, fading: false });
        setTimeout(() => {
            useChatStore.getState().setZenModeState(nextZenState);
        }, 400);
        setTimeout(() => {
            setRevealCircle(prev => prev ? { ...prev, fading: true } : null);
        }, 1800);
        setTimeout(() => {
            setRevealCircle(null);
        }, 3600);
    }, []);

    /* CINEMATIC SEQUENCE COMMENTED OUT — preserved for future use
    const runCinematicSequence = useCallback((clientX, clientY) => {
        clearCinematicTimers();
        setCinematicPhase("fade-black");
        const t1 = setTimeout(() => { setCinematicPhase("disclaimer"); }, 500);
        const t2 = setTimeout(() => { setCinematicPhase("fade-disclaimer"); }, 2500);
        const t3 = setTimeout(() => { setCinematicPhase("noise"); startZenIntroAudio(); }, 3000);
        const t4 = setTimeout(() => { setCinematicPhase("implosion"); }, 5500);
        const t5 = setTimeout(() => { setCinematicPhase("bloom"); }, 8000);
        const t6 = setTimeout(() => { setCinematicPhase("mode-name"); }, 11500);
        const t7 = setTimeout(() => { setCinematicPhase("integration"); }, 12500);
        const t8 = setTimeout(() => {
            setCinematicPhase(null);
            localStorage.setItem("zen_intro_shown", "true");
            triggerCircularReveal(clientX, clientY, true);
        }, 14000);
        cinematicTimers.current = [t1, t2, t3, t4, t5, t6, t7, t8];
    }, [clearCinematicTimers, triggerCircularReveal]);
    */


    const handleZenToggle = useCallback((e) => {
        e.stopPropagation();
        if (!activeChat?._id || !otherUser?._id) return;
        const wasZen = isZenMode;
        if (!wasZen) {
            if (!isPeerOnline) {
                showZenToast("error", "ZenMode can only be activated when the other user is online.");
                return;
            }
            socket.emit("zen_invite_send", {
                chatId: activeChat._id,
                senderId: user._id,
                receiverId: otherUser._id
            });
            setZenWaitingState("invite-waiting");
            startZenTimer("invite-waiting", activeChat._id, user._id, otherUser._id);
        } else {
            setShowExitConfirm(true);
        }
    }, [isZenMode, isPeerOnline, socket, activeChat?._id, user?._id, otherUser?._id, startZenTimer, showZenToast, setZenWaitingState, setShowExitConfirm]);

    const handleBackClick = useCallback((e) => {
        if (isZenMode) {
            if (hasInitiatedBackRef) {
                hasInitiatedBackRef.current = true;
            }
            setShowExitConfirm(true);
        } else {
            onBack();
        }
    }, [isZenMode, onBack, hasInitiatedBackRef, setShowExitConfirm]);

    const handleSkipIntro = useCallback((e) => {
        if (e) e.stopPropagation();
        clearCinematicTimers();
        stopZenIntroAudio();
        setCinematicPhase(null);
        localStorage.setItem("zen_intro_shown", "true");
        if (!isZenMode) {
            useChatStore.getState().setZenModeState(true);
        }
    }, [isZenMode, clearCinematicTimers]);

    useEffect(() => {
        return () => {
            clearCinematicTimers();
            stopZenIntroAudio();
            clearOfflineTimers();
            useChatStore.getState().setZenModeState(false);
        };
    }, [clearCinematicTimers, clearOfflineTimers]);

    const prevIsZenModeAnimRef = useRef(isZenMode);
    useEffect(() => {
        if (prevIsZenModeAnimRef.current === false && isZenMode === true) {
            triggerCircularReveal(window.innerWidth / 2, window.innerHeight / 2, true);
        } else if (prevIsZenModeAnimRef.current === true && isZenMode === false) {
            triggerCircularReveal(window.innerWidth / 2, window.innerHeight / 2, false);
        }
        prevIsZenModeAnimRef.current = isZenMode;
    }, [isZenMode, triggerCircularReveal]);

    // ZenMode off: purge all ZenMode messages from server + store for both sides
    const socketRef = useRef(socket);
    useEffect(() => { socketRef.current = socket; }, [socket]);

    useEffect(() => {
        const currentChatId = activeChat?._id;
        const currentIsZenMode = isZenMode;
        
        return () => {
            if (currentIsZenMode && currentChatId) {
                const msgs = useChatStore.getState().messages[currentChatId] || [];
                const zenIds = msgs.filter(m => m.isZenMessage && m._id).map(m => m._id);
                if (zenIds.length > 0 && socketRef.current?.connected) {
                    socketRef.current.emit("zen_session_clear", { chatId: currentChatId, messageIds: zenIds });
                }
                // Optimistic local purge immediately
                useChatStore.getState().purgeZenMessages(currentChatId);
            }
        };
    }, [isZenMode, activeChat?._id]);

    useEffect(() => {
        if (socket?.connected) {
            socket.emit("zen_mode_status", { isZenMode });
        }
    }, [isZenMode, socket, socket?.connected]);

    const handleToggleDisappearing = async (mode) => {
        try {
            await axiosInstance.put(`/chats/${activeChat._id}/disappearing`, { mode });
            setShowDisappearingMenu(false);
            // Local state will update via socket 'chat_updated' which we need to handle in chatStore
            useChatStore.getState().updateChat(activeChat._id, { disappearingMode: mode });
        } catch (err) {
            console.error("Failed to update disappearing mode", err);
        }
    };

    const handleMessageAction = (msg) => {
        if (msg.action === "reply") {
            setReplyingTo(msg);
            setEditingMessage(null);
        } else if (msg.action === "select") {
            // Enter multi-select and toggle this message's selection
            setIsMultiSelectMode(true);
            setSelectedMessageIds(prev => {
                const next = new Set(prev);
                const id = msg._id;
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            });
        } else if (msg.action === "forward") {
            // Forward a single message: enter select mode with this message pre-selected
            setIsMultiSelectMode(true);
            setSelectedMessageIds(new Set([msg._id]));
            setShowForwardModal(true);
        } else {
            setEditingMessage(msg);
            setReplyingTo(null);
        }
    };

    const handleToggleSelect = (msgId) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
            return next;
        });
    };

    const handleExitMultiSelect = () => {
        setIsMultiSelectMode(false);
        setSelectedMessageIds(new Set());
        setShowForwardModal(false);
    };



    const deletedPhrase = useMemo(() => {
        if (!activeChat?._id) return DELETED_PHRASES[0];
        const hash = activeChat._id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return DELETED_PHRASES[hash % DELETED_PHRASES.length];
    }, [activeChat?._id]);

    const typingScramble = useMemo(() => {
        if (!activeChat || !otherUserId) return null;
        const chatTyping = typingUsers[activeChat._id];
        return chatTyping?.[otherUserId] || null;
    }, [typingUsers, activeChat?._id, otherUserId]);

    const hasMoments = useMemo(() => {
        if (!otherUserId) return false;
        return hasActiveMoment(otherUserId);
    }, [otherUserId, hasActiveMoment]);

    const isTyping = !!typingScramble;

    const isVoiceRecording = useMemo(() => {
        if (!activeChat || !otherUserId) return false;
        const chatRec = voiceRecordingUsers?.[activeChat._id];
        return !!(chatRec && chatRec[otherUserId]);
    }, [voiceRecordingUsers, activeChat?._id, otherUserId]);

    const isOtherUserLowBandwidth = useMemo(() => {
        if (otherUserId && peerLowBandwidth[otherUserId] === true) return true;
        if (isTyping && (!typingScramble || typeof typingScramble !== "string")) return true;
        return false;
    }, [otherUserId, peerLowBandwidth, isTyping, typingScramble]);

    const isSPOpActive = isLowBandwidth || isOtherUserLowBandwidth;

    const inferredOtherUserId = useMemo(() => {
        if (otherUserId) return otherUserId;
        if (!isDeleted) return null;
        const msg = rawMessages.find(m => {
            const sId = m.senderId?._id?.toString() || m.senderId?.toString();
            return sId && sId !== user?._id?.toString();
        });
        return msg?.senderId?._id?.toString() || msg?.senderId?.toString();
    }, [otherUserId, isDeleted, rawMessages, user?._id]);

    const isContact = contacts?.some(
        c => {
            const uid = c.userId?._id?.toString() || c.userId?.toString();
            return uid === otherUserId || (inferredOtherUserId && uid === inferredOtherUserId);
        }
    );
    const displayName = isDeleted ? "(user_deleted)" : otherUser?.username;

    useEffect(() => {
        if (isZenMode && !isPeerOnline) {
            if (offlineCountdownIntervalRef.current) return;
            
            let remaining = 30;
            setOfflineCountdown(remaining);
            
            offlineCountdownIntervalRef.current = setInterval(() => {
                remaining -= 1;
                if (remaining > 0) {
                    setOfflineCountdown(remaining);
                } else {
                    clearInterval(offlineCountdownIntervalRef.current);
                    offlineCountdownIntervalRef.current = null;
                    setOfflineCountdown(null);
                    
                    if (socket?.connected) {
                        socket.emit("zen_exit_respond", { 
                            chatId: activeChat._id, 
                            responderId: user._id, 
                            requesterId: otherUserId, 
                            accepted: true 
                        });
                    }
                    triggerCircularReveal(window.innerWidth / 2, window.innerHeight / 2, false);
                    showZenToast("info", "ZenMode ended due to inactivity");
                }
            }, 1000);
        } else {
            if (offlineCountdownIntervalRef.current) {
                clearInterval(offlineCountdownIntervalRef.current);
                offlineCountdownIntervalRef.current = null;
                
                if (isZenMode && isPeerOnline) {
                    showZenToast("success", `${displayName || "User"} came back online`);
                }
            }
            setOfflineCountdown(null);
        }
        
        return () => {
            if (offlineCountdownIntervalRef.current) {
                clearInterval(offlineCountdownIntervalRef.current);
                offlineCountdownIntervalRef.current = null;
            }
        };
    }, [isZenMode, isPeerOnline, activeChat?._id, user?._id, otherUserId, socket, triggerCircularReveal, showZenToast, displayName]);

    useEffect(() => {
        if (!activeChat?._id || !otherUserId) return;
        const otherZen = zenUsers[otherUserId];
        if (isZenMode && isPeerOnline && otherZen === false) {
            triggerCircularReveal(window.innerWidth / 2, window.innerHeight / 2, false);
            showZenToast("info", "ZenMode ended because peer is no longer in #ZenMode");
        }
    }, [isZenMode, zenUsers, otherUserId, isPeerOnline, triggerCircularReveal, showZenToast, activeChat?._id]);

    useEffect(() => {
        if (!activeChat?._id) return;
        const chatId = activeChat._id;

        const isMobile = window.innerWidth <= 768;
        const markIfVisible = () => {
            if (isMobile && !onBack) return;
            if (!isMobile && !document.hasFocus()) return;
            markChatAsRead(chatId);
            markAsRead(chatId);
        };


        joinChat(chatId);
        fetchMessages(chatId).then(() => {
            markIfVisible();
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
                setShowScrollDown(false);
            }, 150);
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && activeChat?._id) {
                markIfVisible();
            }
        };

        window.addEventListener('focus', markIfVisible);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('focus', markIfVisible);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeChat?._id, activeChat?.disappearingMode]);

    useEffect(() => {
        setEditingMessage(null);
        setReplyingTo(null);
        setDeletingMessage(null);
        zenExitTimeoutCountRef.current = 0;
        clearZenTimers();
        setOfflineCountdown(null);
        useChatStore.getState().setZenModeState(false);
    }, [activeChat?._id, clearZenTimers]);

    useEffect(() => {
        if (activeChat?._id && updateLowBandwidth) {
            updateLowBandwidth(activeChat._id, isLowBandwidth);
        }
    }, [activeChat?._id, isLowBandwidth, updateLowBandwidth]);

    useEffect(() => {
        if (!showScrollDown && !isLoadingOlderRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages.length, showScrollDown]);

    useEffect(() => {
        if (isTyping && !showScrollDown) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [isTyping, showScrollDown]);

    const bounceTimeout = useRef(null);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        setShowScrollDown(!isNearBottom);

        const atTop = scrollTop === 0;
        const atBottom = scrollHeight - scrollTop - clientHeight <= 1;
        if ((atTop || atBottom) && !bounceTimeout.current) {
            const cls = atTop ? 'bounce-top' : 'bounce-bottom';
            messagesContainerRef.current?.classList.add(cls);
            bounceTimeout.current = setTimeout(() => {
                messagesContainerRef.current?.classList.remove(cls);
                bounceTimeout.current = null;
            }, 400);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowScrollDown(false);
    };

    const [tick, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    const statusText = useMemo(() => {
        if (!otherUser) return "";
        if (isOffline || activeChat?.blockStatus?.iBlocked || activeChat?.blockStatus?.theyBlocked) return "Offline";
        const isOtherInZen = zenUsers[otherUser._id] || zenUsers[otherUser._id?.toString()];
        if (isPeerOnline) {
            return isOtherInZen ? "Online - on #ZenMode" : "Online";
        }
        if (otherUser.lastSeen) {
            return `Last seen ${formatDistanceToNow(new Date(otherUser.lastSeen), { addSuffix: true })}`;
        }
        return "Offline";
    }, [otherUser, isPeerOnline, tick, isOffline, activeChat?.blockStatus?.iBlocked, activeChat?.blockStatus?.theyBlocked, zenUsers]);

    const getStatusText = () => statusText;

    const handleDeleteConfirm = (deleteFor) => {
        if (!deletingMessage) return;
        const msgId = deletingMessage._id || deletingMessage.cid;
        // Optimistically remove from local store immediately - don't wait for server
        useChatStore.getState().deleteMessage(activeChat._id, msgId, deleteFor);
        // Also tell the server if it's a real message (fire-and-forget)
        if (deletingMessage._id) {
            deleteMessage(activeChat._id, msgId, deleteFor);
        }
        setDeletingMessage(null);
    };


    if (!activeChat) {
        return (
            <div className="chat-empty-state" style={{ position: "relative" }}>
                <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <rect width="32" height="32" rx="10" fill="#1e2530" />
                    <path d="M8 10h16M8 16h10M8 22h13" stroke="#3da5d9" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                <p className="chat-empty-title">ZenChat</p>
                <span className="chat-empty-hint">Select a conversation or search for a user to start chatting</span>
            </div>
        );
    }

    return (
        <div className={`chat-window ${isDeleted ? 'user-deleted-mode' : ''} ${isZenMode ? 'zen-active' : ''}`} style={{ position: 'relative' }}>
            <div className="chat-header" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                <button className="chat-back-btn" onClick={handleBackClick} aria-label="Back to chats">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div
                    className="chat-header-avatar-wrap"
                >
                    <div
                        className={`avatar avatar-md ${hasMoments && !activeChat?.blockStatus?.iBlocked && !activeChat?.blockStatus?.theyBlocked ? 'moments-halo-thin' : ''}`}
                        style={hasMoments && !activeChat?.blockStatus?.iBlocked && !activeChat?.blockStatus?.theyBlocked ? { '--halo-color': useMomentStore.getState().getHaloColor(otherUser?._id, user?._id) } : {}}
                    >
                        {otherUser?.avatar ? (
                            <img src={otherUser.avatar} alt={otherUser.username} loading="lazy" />
                        ) : (
                            <span>{otherUser?.username?.slice(0, 2).toUpperCase()}</span>
                        )}
                    </div>
                    {isPeerOnline && (
                        <OnlineDot isSPOp={isOtherUserLowBandwidth} />
                    )}
                </div>

                <div
                    className="chat-header-info"
                    onClick={() => setShowUserCard(true)}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="chat-header-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span
                            className={isContact ? "chat-card-name-contact" : (isDeleted ? "deleted-user-name" : "")}
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                            {displayName}
                        </span>
                        {otherUser?.isVerified && <span style={{ flexShrink: 0, display: 'flex' }}><VerifiedTick /></span>}
                    </span>
                    <span className={`chat-header-status ${isPeerOnline ? "status-online" : ""}`}>
                        {getStatusText()}
                    </span>
                </div>

                <div className="chat-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <button
                            className="header-action-btn"
                            disabled
                            title="Coming soon!"
                            style={{ flexShrink: 0, opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'none' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </button>

                        {showDisappearingMenu && (
                            <div className="message-action-dropdown disappearing-menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', minWidth: '135px', background: '#161b22', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '4px' }}>
                                {[
                                    { value: 'off', label: 'Off' },
                                    { value: 'instant', label: 'Going offline' },
                                    { value: '1h', label: '1 Hour' },
                                    { value: '8h', label: '8 Hours' },
                                    { value: '24h', label: '1 Day' },
                                    { value: '7d', label: '7 Days' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        className="message-dropdown-item"
                                        style={{ background: activeChat?.disappearingMode === opt.value ? 'rgba(61, 165, 217, 0.15)' : 'transparent', color: activeChat?.disappearingMode === opt.value ? '#3da5d9' : 'rgba(255,255,255,0.8)' }}
                                        onClick={() => handleToggleDisappearing(opt.value)}
                                    >
                                        {activeChat?.disappearingMode === opt.value && <span style={{ marginRight: '4px' }}>✓</span>}
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        className={`header-action-btn zen-toggle-btn ${isZenMode ? 'active' : ''}`}
                        onClick={handleZenToggle}
                        title="toggle to activate/deactivate #ZenMode. for this chat."
                        style={{ flexShrink: 0 }}
                    >
                        <svg width="22" height="22" viewBox="0 0 32 32" fill="none" style={{ display: 'block' }}>
                            <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.2" fill="none" opacity="0.4"/>
                            <circle cx="16" cy="16" r="13" stroke="var(--color-primary)" strokeWidth="2.2" fill="none" strokeDasharray={`${2 * Math.PI * 13}`} strokeDashoffset={isZenMode ? 0 : `${2 * Math.PI * 13}`} transform="rotate(-90 16 16)" style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                            <text x="16" y="20.5" textAnchor="middle" fontSize="10.5" fontWeight="900" fill={isZenMode ? "var(--color-primary)" : "currentColor"} fontFamily="inherit">Z</text>
                        </svg>
                    </button>

                    <button
                        className={`header-action-btn ${showOnlyStarred ? 'active' : ''}`}
                        onClick={() => setShowOnlyStarred(!showOnlyStarred)}
                        title={showOnlyStarred ? "Show all messages" : "Show only starred messages"}
                        style={{ flexShrink: 0 }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={showOnlyStarred ? "#eab308" : "none"} stroke={showOnlyStarred ? "#eab308" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll} style={{ position: "relative", zIndex: 1, background: "transparent" }}>
                {!isZenMode && (hasMoreMessages[activeChat?._id] || isLoadingOlderMessages) && !isLoadingMessages && (!showOnlyStarred || messages.length > 18) && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
                        <button
                            className="load-more-btn"
                            onClick={async () => {
                                const container = messagesContainerRef.current;
                                const prevScrollHeight = container?.scrollHeight || 0;
                                isLoadingOlderRef.current = true;
                                await fetchOlderMessages(activeChat._id);
                                isLoadingOlderRef.current = false;
                                requestAnimationFrame(() => {
                                    if (container) {
                                        container.scrollTop = container.scrollHeight - prevScrollHeight;
                                    }
                                });
                            }}
                            disabled={isLoadingOlderMessages}
                        >
                            {isLoadingOlderMessages ? (
                                <span className="banner-spinner" style={{ width: 14, height: 14 }} />
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="17 11 12 6 7 11" />
                                    <polyline points="17 18 12 13 7 18" />
                                </svg>
                            )}
                            {isLoadingOlderMessages ? 'Loading...' : 'Load older messages'}
                        </button>
                    </div>
                )}

                {!isLoadingMessages && messages.length > 0 && (
                    <div className="chat-messages-spacer" style={{ flex: '1 1 auto', minHeight: 0 }} />
                )}
                {isLoadingMessages && messages.length === 0 && (
                    <div className="messages-loading">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className={`message-skeleton ${i % 2 === 0 ? "mine" : ""}`}>
                                <div className="skeleton skeleton-bubble" style={{ width: `${[55, 40, 65, 35][i - 1]}%` }} />
                            </div>
                        ))}
                    </div>
                )}

                {!isLoadingMessages && messages.length === 0 && (
                    <div className="messages-empty">
                        <span>{showOnlyStarred ? 'No messages marked as "Fav"' : 'No messages yet - say Hi!'}</span>
                    </div>
                )}
                {messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    const msgDate = new Date(msg.createdAt).toLocaleDateString();
                    const prevDate = prevMsg ? new Date(prevMsg.createdAt).toLocaleDateString() : null;
                    const showDateDivider = msgDate !== prevDate;

                    const zenMessagesAfter = messages.slice(idx + 1).filter(m => m.isZenMessage).length;
                    
                    let zenFadeClass = "";
                    if (isZenMode) {
                        if (!msg.isZenMessage) {
                            zenFadeClass = "zen-fade-3";
                        } else {
                            if (zenMessagesAfter === 2) zenFadeClass = "zen-fade-1";
                            else if (zenMessagesAfter === 3) zenFadeClass = "zen-fade-2";
                            else if (zenMessagesAfter >= 4) zenFadeClass = "zen-fade-3";
                        }
                    }

                    return (
                        <div key={`wrap-${msg._id}`} style={{ display: 'contents' }}>
                            {showDateDivider && (
                                <div className="message-date-divider" style={{ textAlign: 'center', margin: '20px 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                    <span style={{ background: 'rgba(30, 37, 48, 0.6)', padding: '6px 14px', borderRadius: '16px', backdropFilter: 'blur(4px)' }}>
                                        {new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: new Date(msg.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}
                                    </span>
                                </div>
                            )}
                            <MessageBubble
                                key={msg._id}
                                message={msg}
                                isMe={msg.senderId?._id === user?._id || msg.senderId === user?._id}
                                showAvatar={idx === 0 || messages[idx - 1]?.senderId?._id !== msg.senderId?._id || showDateDivider}
                                otherUser={otherUser}
                                onEdit={handleMessageAction}
                                onDelete={setDeletingMessage}
                                canDelete={!msg.deletedForEveryone && !activeChat?.blockStatus?.iBlocked && !activeChat?.blockStatus?.theyBlocked}
                                canReply={!msg.deletedForEveryone && !activeChat?.blockStatus?.iBlocked && !activeChat?.blockStatus?.theyBlocked}
                                zenFadeClass={zenFadeClass}
                                isMultiSelectMode={isMultiSelectMode}
                                isSelected={selectedMessageIds.has(msg._id)}
                                onSelect={handleToggleSelect}
                                onMediaClick={(url, type, isViewOnce) => {
                                    if (isMultiSelectMode) return;
                                    if (type === "file") {
                                        setSelectedDoc({ url, fileName: msg.content || "document" });
                                    } else {
                                        const senderName = (msg.senderId?._id === user?._id || msg.senderId === user?._id)
                                            ? "me"
                                            : (msg.senderId?.username || otherUser?.username || "user");
                                        setSelectedMedia({ url, type, username: senderName, isViewOnce });
                                    }
                                }}
                            />
                        </div>
                    );
                })}

                {isVoiceRecording && !isTyping && (
                    <div className="voice-recording-indicator">
                        <span className="voice-rec-dot" aria-hidden="true" />
                        <span>Recording voice message…</span>
                    </div>
                )}
                {isTyping && <TypingIndicator scramble={isSPOpActive ? "" : (typeof typingScramble === "string" ? typingScramble : "")} />}
                <div ref={messagesEndRef} />
            </div>
            <ScrollDownBtn onClick={scrollToBottom} show={showScrollDown} isLifted={!!replyingTo} />

            {activeChat?.disappearingMode && activeChat.disappearingMode !== 'off' && !showOnlyStarred && (
                <DisappearingBanner
                    mode={activeChat.disappearingMode}
                    onDisable={() => handleToggleDisappearing('off')}
                />
            )}

            {isDeleted && (
                <div className="deleted-user-banner" style={{
                    padding: '12px',
                    textAlign: 'center',
                    background: 'rgba(30, 30, 30, 0.4)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    color: '#94a3b8',
                    fontSize: '0.85rem',
                    fontStyle: 'italic'
                }}>
                    "{deletedPhrase}"
                    <div style={{ marginTop: '4px', fontSize: '0.7rem', opacity: 0.6 }}>
                        This account has been deleted.
                    </div>
                </div>
            )}

            {offlineCountdown !== null && (
                <div className="zen-offline-banner">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ marginRight: '8px', flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>@{displayName || "User"} has gone offline - exiting #ZenMode in {offlineCountdown} seconds</span>
                </div>
            )}

            {isMultiSelectMode ? (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px',
                    background: 'rgba(16, 22, 32, 0.95)',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    animation: 'slideUp 0.2s ease-out'
                }}>
                    <button onClick={handleExitMultiSelect} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '10px', padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: '0.9rem', color: '#8b949e', fontWeight: 600 }}>
                        {selectedMessageIds.size} selected
                    </span>
                    <button
                        onClick={() => setShowForwardModal(true)}
                        disabled={selectedMessageIds.size === 0}
                        style={{ background: selectedMessageIds.size > 0 ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)', border: 'none', color: selectedMessageIds.size > 0 ? '#fff' : '#64748b', borderRadius: '10px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700, cursor: selectedMessageIds.size > 0 ? 'pointer' : 'default', transition: 'all 0.2s' }}
                    >
                        Confirm Selection
                    </button>
                </div>
            ) : (
                <MessageInput
                    chatId={activeChat._id}
                    editingMessage={editingMessage}
                    replyingTo={replyingTo}
                    onCancelEdit={() => setEditingMessage(null)}
                    onCancelReply={() => setReplyingTo(null)}
                    disabled={isDeleted || showOnlyStarred || activeChat?.blockStatus?.iBlocked || activeChat?.blockStatus?.theyBlocked}
                    disabledPlaceholder={
                        isDeleted ? "Account deleted..." :
                        showOnlyStarred ? "Sending disabled in Fav mode..." :
                        activeChat?.blockStatus?.iBlocked ? "You have blocked this user" :
                        activeChat?.blockStatus?.theyBlocked ? "You have been blocked by this user" :
                        "Sending disabled..."
                    }
                />
            )}


            {deletingMessage && (
                <div className="delete-modal-overlay">
                    <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
                        <p className="delete-modal-title">Delete message?</p>
                        <p className="delete-modal-subtitle">This action cannot be undone.</p>
                        <div className="delete-modal-actions">
                            <button className="delete-modal-btn cancel" onClick={() => setDeletingMessage(null)}>
                                Cancel
                            </button>
                            <button className="delete-modal-btn self" onClick={() => handleDeleteConfirm("self")}>
                                Delete for me
                            </button>
                            {!isDeleted && !activeChat?.blockStatus?.iBlocked && !activeChat?.blockStatus?.theyBlocked && (
                                <button className="delete-modal-btn everyone" onClick={() => handleDeleteConfirm("everyone")}>
                                    Delete for everyone
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <UserCardModal
                isOpen={showUserCard}
                onClose={() => setShowUserCard(false)}
                user={otherUser}
                isOnline={isPeerOnline}
                isSPOp={isOtherUserLowBandwidth}
                hasMoments={hasMoments}
                isContact={isContact}
                iBlocked={activeChat?.blockStatus?.iBlocked}
                theyBlocked={activeChat?.blockStatus?.theyBlocked}
                onViewMoments={() => {
                    const moments = useMomentStore.getState().moments.filter(m => (m.userId?._id || m.userId)?.toString() === otherUser?._id?.toString());
                    setActiveViewerMoments(moments);
                    setShowUserCard(false);
                }}
            />

            <MomentViewer 
                moments={activeViewerMoments || []}
                isOpen={!!activeViewerMoments}
                onClose={() => setActiveViewerMoments(null)}
            />

            {selectedMedia && (
                <MediaViewerModal
                    url={selectedMedia.url}
                    type={selectedMedia.type}
                    username={selectedMedia.username}
                    isViewOnce={selectedMedia.isViewOnce}
                    onClose={() => setSelectedMedia(null)}
                />
            )}

            {selectedDoc && (
                <DocViewerModal
                    url={selectedDoc.url}
                    fileName={selectedDoc.fileName}
                    onClose={() => setSelectedDoc(null)}
                />
            )}

            {/* Cinematic overlay commented out — preserved for future use
            {cinematicPhase && (
                <div className={`zen-cinematic-overlay phase-${cinematicPhase}`}>
                    <button className="zen-skip-btn" onClick={handleSkipIntro}>Skip</button>
                    <ZenParticleCanvas phase={cinematicPhase} noiseElements={noiseElements} />
                </div>
            )}
            */}
            
            {revealCircle && (
                <div
                    className={`zen-reveal-circle ${revealCircle.fading ? 'fade-out' : ''}`}
                    style={{
                        left: revealCircle.x,
                        top: revealCircle.y,
                        '--reveal-radius': `${Math.max(window.innerWidth, window.innerHeight) * 1.5}px`
                    }}
                />
            )}


            {localToast && (
                <div className={`zen-toast zen-toast-${localToast.type}`} style={{ zIndex: 10001, bottom: '80px' }}>
                    {localToast.msg}
                </div>
            )}

            {/* ── BulkActionSheet: shown when user taps "Confirm Selection" ── */}
            {showForwardModal && isMultiSelectMode && (() => {
                const selectedMsgs = messages.filter(m => selectedMessageIds.has(m._id));
                const allMine = selectedMsgs.every(m => m.senderId?._id === user?._id || m.senderId === user?._id);
                const tooMany = selectedMsgs.length > 5;
                return createPortal(
                    <div
                        onClick={() => setShowForwardModal(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(9,13,20,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 9999999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out' }}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{ width: '100%', maxWidth: '500px', background: 'linear-gradient(180deg, #1a2030 0%, #161b22 100%)', borderTop: '1px solid rgba(255,255,255,0.07)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '0 0 env(safe-area-inset-bottom, 28px)', boxShadow: '0 -12px 48px rgba(0,0,0,0.6)', animation: 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)' }}
                        >
                            {/* Drag handle */}
                            <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '14px auto 0' }} />

                            <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                                    {selectedMsgs.length} message{selectedMsgs.length !== 1 ? 's' : ''} selected
                                </span>
                                {tooMany && (
                                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>Max 5 per share</span>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0 8px' }}>
                                {/* Forward */}
                                <button
                                    onClick={async () => {
                                        if (tooMany) { showToast('Max 5 messages per forward', 'error'); return; }
                                        setShowForwardModal(false);
                                        handleExitMultiSelect();
                                        showToast('Forwarding not yet implemented — coming soon!', 'info');
                                    }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', color: tooMany ? '#64748b' : '#c9d1d9', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: tooMany ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                                    onTouchStart={e => !tooMany && (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                    onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="15 10 20 15 15 20" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
                                    </svg>
                                    <span>Forward selected <span style={{ opacity: 0.55, fontSize: '0.8rem' }}>(max 5 per share)</span></span>
                                </button>

                                {/* Mark as Fav */}
                                <button
                                    onClick={async () => {
                                        const { toggleStarMessage } = useChatStore.getState();
                                        for (const msg of selectedMsgs) {
                                            if (msg._id) toggleStarMessage(msg._id, activeChat._id);
                                        }
                                        setShowForwardModal(false);
                                        handleExitMultiSelect();
                                        showToast(`${selectedMsgs.length} message${selectedMsgs.length !== 1 ? 's' : ''} marked as Fav`, 'success');
                                    }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', color: '#c9d1d9', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onTouchStart={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                    onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                    <span>Mark selected as Fav</span>
                                </button>

                                {/* Delete for Me */}
                                <button
                                    onClick={() => {
                                        selectedMsgs.forEach(msg => {
                                            const msgId = msg._id || msg.cid;
                                            useChatStore.getState().deleteMessage(activeChat._id, msgId, 'me');
                                            if (msg._id) deleteMessage(activeChat._id, msgId, 'me');
                                        });
                                        setShowForwardModal(false);
                                        handleExitMultiSelect();
                                        showToast('Deleted for you', 'success');
                                    }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.93rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onTouchStart={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.07)')}
                                    onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    <span>Delete selected for me</span>
                                </button>

                                {/* Delete for Everyone — only if all selected are mine */}
                                {allMine && (
                                    <button
                                        onClick={() => {
                                            selectedMsgs.forEach(msg => {
                                                const msgId = msg._id || msg.cid;
                                                useChatStore.getState().deleteMessage(activeChat._id, msgId, 'everyone');
                                                if (msg._id) deleteMessage(activeChat._id, msgId, 'everyone');
                                            });
                                            setShowForwardModal(false);
                                            handleExitMultiSelect();
                                            showToast('Deleted for everyone', 'success');
                                        }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'transparent', border: 'none', color: '#f85149', fontSize: '0.93rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onTouchStart={e => (e.currentTarget.style.background = 'rgba(248,81,73,0.07)')}
                                        onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                                        </svg>
                                        <span>Delete selected for everyone</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}

        </div>
    );
};

export default memo(ChatWindow);