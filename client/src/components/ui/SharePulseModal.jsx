import { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";

const SharePulseModal = ({ isOpen, onClose, question, username }) => {
    const [activeTab, setActiveTab] = useState("download");
    const [copied, setCopied] = useState(false);
    const [imageBlob, setImageBlob] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [generating, setGenerating] = useState(false);
    const tabsRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    // Calculate voted options (only those with at least 1 vote), sorted by vote count desc
    const votedOptions = [];
    if (question && question.options && question.options.length > 0) {
        const total = question.totalVotes || 1;
        question.options.forEach(opt => {
            const count = question.optionCounts?.[opt.id] || 0;
            if (count > 0) {
                votedOptions.push({
                    text: opt.text,
                    count,
                    percentage: Math.round((count / total) * 100)
                });
            }
        });
        votedOptions.sort((a, b) => b.count - a.count);
    }

    const topOption = votedOptions[0] || null;
    const topPercentage = topOption?.percentage || 0;
    
    const isToday = question && (!question.optionCounts || Object.keys(question.optionCounts).length === 0);
    const optionsToRender = isToday ? (question?.options || []).map(opt => ({ text: opt.text, percentage: null })) : votedOptions;

    // Generate Share Card Image on Canvas
    useEffect(() => {
        if (!isOpen || !question || optionsToRender.length === 0) return;

        setGenerating(true);
        const canvas = document.createElement("canvas");
        canvas.width = 1080;

        // Dynamic height: base + per-bar slot
        const BAR_SLOT = 160; // height per option bar including gap
        const BASE_HEIGHT = 720; // header + question + footer space
        canvas.height = BASE_HEIGHT + optionsToRender.length * BAR_SLOT;

        const ctx = canvas.getContext("2d");
        const canvasHeight = canvas.height;

        const drawCard = () => {
            // 1. Radial Gradient Background
            const bgGrad = ctx.createRadialGradient(
                canvas.width / 2, canvasHeight / 2, 100,
                canvas.width / 2, canvasHeight / 2, 900
            );
            bgGrad.addColorStop(0, "#1e1b4b");
            bgGrad.addColorStop(0.5, "#0f172a");
            bgGrad.addColorStop(1, "#020617");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, canvas.width, canvasHeight);

            // 2. Glassmorphism Card Container
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 50;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 24;
            ctx.fillStyle = "rgba(30,41,59,0.4)";
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.lineWidth = 2;

            const boxPad = 80;
            const boxWidth = canvas.width - boxPad * 2;
            const boxHeight = canvasHeight - 140;
            const boxX = boxPad;
            const boxY = 80;

            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 36);
            ctx.fill();
            ctx.stroke();

            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // 3. Header Branding
            ctx.fillStyle = "#ffffff";
            ctx.font = 'bold 64px "Outfit","Inter",-apple-system,sans-serif';
            ctx.textAlign = "center";
            ctx.fillText("ZenPulse", canvas.width / 2, 210);

            ctx.fillStyle = "#38bdf8";
            ctx.font = '600 32px "Inter",-apple-system,sans-serif';
            ctx.fillText("DAILY COMMUNITY OPINION", canvas.width / 2, 268);

            // 4. Wrapped Question Text
            ctx.fillStyle = "#ffffff";
            ctx.font = 'bold 46px "Inter",-apple-system,sans-serif';
            const words = question.question.split(" ");
            let line = "";
            let y = 390;
            const maxQW = 800;
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + " ";
                if (ctx.measureText(testLine).width > maxQW && n > 0) {
                    ctx.fillText(line, canvas.width / 2, y);
                    line = words[n] + " ";
                    y += 64;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, canvas.width / 2, y);

            // 5. All voted option bars
            const barWidth = 860;
            const barHeight = 110;
            const barX = (canvas.width - barWidth) / 2;
            let barStartY = y + 70;

            optionsToRender.forEach((opt, idx) => {
                const barY = barStartY + idx * BAR_SLOT;

                // Bar background
                ctx.fillStyle = "rgba(255,255,255,0.04)";
                ctx.strokeStyle = "rgba(255,255,255,0.08)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(barX, barY, barWidth, barHeight, 18);
                ctx.fill();
                ctx.stroke();

                // Progress fill
                const fillWidth = opt.percentage !== null ? (barWidth * opt.percentage) / 100 : 0;
                if (fillWidth > 0) {
                    // Top bar uses blue-cyan gradient, rest use a slightly muted variant
                    const grad = ctx.createLinearGradient(barX, 0, barX + fillWidth, 0);
                    if (idx === 0) {
                        grad.addColorStop(0, "#2563eb");
                        grad.addColorStop(1, "#06b6d4");
                    } else {
                        grad.addColorStop(0, "#1d4ed8");
                        grad.addColorStop(1, "#0284c7");
                    }
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.roundRect(
                        barX, barY, fillWidth, barHeight,
                        [18, opt.percentage >= 98 ? 18 : 4, opt.percentage >= 98 ? 18 : 4, 18]
                    );
                    ctx.fill();
                }

                // Labels
                ctx.font = 'bold 34px "Inter",-apple-system,sans-serif';
                ctx.fillStyle = "#ffffff";
                
                if (opt.percentage !== null) {
                    const pctText = `${opt.percentage}% agreed`;
                    const pctW = ctx.measureText(pctText).width;
                    const maxOptW = barWidth - pctW - 100;

                    let optText = opt.text;
                    while (ctx.measureText(optText).width > maxOptW && optText.length > 0) {
                        optText = optText.slice(0, -1);
                    }
                    if (optText !== opt.text) optText += "...";

                    ctx.textAlign = "left";
                    ctx.fillText(optText, barX + 40, barY + 63);
                    ctx.textAlign = "right";
                    ctx.fillText(pctText, barX + barWidth - 40, barY + 63);
                } else {
                    ctx.textAlign = "center";
                    let optText = opt.text;
                    const maxOptW = barWidth - 80;
                    while (ctx.measureText(optText).width > maxOptW && optText.length > 0) {
                        optText = optText.slice(0, -1);
                    }
                    if (optText !== opt.text) optText += "...";
                    ctx.fillText(optText, canvas.width / 2, barY + 63);
                }
            });

            // 6. Footer CTA
            const footerY = canvasHeight - 80;
            ctx.fillStyle = "#94a3b8";
            ctx.font = '500 28px "Inter",-apple-system,sans-serif';
            ctx.textAlign = "center";
            ctx.fillText(isToday ? "Go vote your opinion at" : "Vote on today's pulse at", canvas.width / 2, footerY - 48);

            ctx.fillStyle = "#38bdf8";
            ctx.font = 'bold 30px "Inter",-apple-system,sans-serif';
            ctx.fillText(`olh-zenchat.vercel.app/zenpulse?ref=${username || "guest"}`, canvas.width / 2, footerY);

            canvas.toBlob(blob => {
                setImageBlob(blob);
                setGenerating(false);
            }, "image/png");
        };

        const timer = setTimeout(drawCard, 200);
        return () => clearTimeout(timer);
    }, [isOpen, question, username]);


    // Handle Blob URL lifecycle
    useEffect(() => {
        if (imageBlob) {
            const url = URL.createObjectURL(imageBlob);
            setImageUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [imageBlob]);

    const inviteLink = `${window.location.origin}/zenpulse?ref=${username || "guest"}`;
    const resultsLines = votedOptions.map(o => `  - ${o.text}: ${o.percentage}% agreed`).join("\n");
    const shareMessage = isToday
        ? `Go vote your opinion on today's ZenPulse:\n\n"${question?.question}"\n\nVote here: ${inviteLink}`
        : `Check out the results for yesterday's ZenPulse:\n\n"${question?.question}"\n\nResults:\n${resultsLines}\n\nVote on today's pulse and see what the community thinks here: ${inviteLink}`;

    const handleAction = async () => {
        if (!imageBlob) return;

        // Try Web Share API (native share dialog supporting files/images)
        const file = new File([imageBlob], "zenpulse-results.png", { type: "image/png" });
        if (activeTab !== "download" && activeTab !== "copy") {
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        title: "ZenPulse Results",
                        text: shareMessage,
                        files: [file]
                    });
                    return;
                } catch (err) {
                    console.log("Native file share failed, falling back to URL redirect", err);
                }
            }
        }

        // Action routing based on selected tab
        switch (activeTab) {
            case "download":
                const a = document.createElement("a");
                a.href = imageUrl;
                a.download = `zenpulse-${new Date().toISOString().split("T")[0]}.png`;
                a.click();
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
                break;
            case "whatsapp":
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`, "_blank");
                break;
            case "telegram":
                window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareMessage)}`, "_blank");
                break;
            case "linkedin":
                navigator.clipboard.writeText(shareMessage);
                window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareMessage)}`, "_blank");
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
                break;
            case "copy":
                navigator.clipboard.writeText(shareMessage);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
                break;
            default:
                break;
        }
    };

    const scrollTabs = (dir) => {
        if (tabsRef.current) {
            tabsRef.current.scrollBy({ left: dir === "left" ? -100 : 100, behavior: "smooth" });
        }
    };

    const tabs = [
        { id: "download", label: "Download PNG", icon: <DownloadIcon />, instr: "Download the high-quality opinion card directly to your device's gallery." },
        { id: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon />, instr: "Share the results card and invite text directly with your contacts, groups, or Status update." },
        { id: "telegram", label: "Telegram", icon: <TelegramIcon />, instr: "Open Telegram to share the results and invite link with your channels, chats, or saved messages." },
        { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon />, instr: "Message copied! Paste the invite post onto your professional feed or send it as a direct message." },
        { id: "copy", label: "Copy Text", icon: <CopyIcon />, instr: "Simply copy the results summary and invite link text directly to your clipboard." }
    ];

    if (!isOpen || !question) return null;

    const currentTab = tabs.find(t => t.id === activeTab);

    return createPortal(
        <div className="modal-overlay moments-aura-overlay" style={{ zIndex: 10000 }}>
            {copied && (
                <div className="zen-toast zen-toast-success" style={{ pointerEvents: "none" }}>
                    {activeTab === "download" ? "Image download started!" : "Results copied to clipboard!"}
                </div>
            )}

            <div className="moments-aura-content invite-modal-v3" onClick={(e) => e.stopPropagation()} style={{ width: "440px", maxWidth: "95%", padding: 0 }}>
                <div className="moments-aura-header">
                    <h2 className="moments-aura-title">Share Results</h2>
                    <button className="aura-close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Generated Card Image Preview */}
                <div className="share-pulse-preview">
                    {generating ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "60px 0" }}>
                            <div className="banner-spinner"></div>
                            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Generating preview card...</span>
                        </div>
                    ) : imageUrl ? (
                        <img src={imageUrl} alt="Opinion card preview" />
                    ) : (
                        <div style={{ padding: "60px 0", color: "#ef4444", fontSize: "0.85rem" }}>Failed to generate card.</div>
                    )}
                </div>

                <div style={{ position: "relative", background: "rgba(0,0,0,0.15)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <button onClick={() => scrollTabs("left")} style={{ ...arrowStyle, left: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>

                    <div ref={tabsRef} className="invite-v2-tabs" style={{ display: "flex", overflowX: "auto", padding: "0 32px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: "16px 20px",
                                    background: "none",
                                    border: "none",
                                    borderBottom: activeTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
                                    color: activeTab === tab.id ? "#fff" : "#64748b",
                                    fontSize: "0.85rem",
                                    fontWeight: activeTab === tab.id ? "600" : "400",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px"
                                }}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <button onClick={() => scrollTabs("right")} style={{ ...arrowStyle, right: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>

                <div className="invite-v2-body" style={{ padding: "30px 24px" }}>
                    <div style={{ textAlign: "center", marginBottom: "25px" }}>
                        <div style={{ fontSize: "2.8rem", marginBottom: "18px", display: "flex", justifyContent: "center" }}>
                            {currentTab?.icon}
                        </div>
                        <h3 style={{ margin: "0 0 10px 0", fontSize: "1.15rem", fontWeight: 600, color: "var(--color-text, #fff)" }}>
                            {activeTab === "download" ? "Download Image" : activeTab === "copy" ? "Copy Text Link" : `Share via ${currentTab?.label}`}
                        </h3>
                        <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.6, maxWidth: "320px", margin: "0 auto" }}>
                            {currentTab?.instr}
                        </p>
                    </div>

                    <button
                        onClick={handleAction}
                        disabled={generating || !imageBlob}
                        style={{
                            width: "100%",
                            padding: "15px",
                            background: generating || !imageBlob ? "#1e293b" : "#3b82f6",
                            color: generating || !imageBlob ? "#64748b" : "#fff",
                            border: "none",
                            borderRadius: "14px",
                            fontSize: "1rem",
                            fontWeight: "600",
                            cursor: generating || !imageBlob ? "not-allowed" : "pointer",
                            boxShadow: generating || !imageBlob ? "none" : "0 8px 20px rgba(59, 130, 246, 0.25)",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={e => {
                            if (!generating && imageBlob) {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.background = "#2563eb";
                            }
                        }}
                        onMouseLeave={e => {
                            if (!generating && imageBlob) {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.background = "#3b82f6";
                            }
                        }}
                    >
                        {activeTab === "download" ? "Download Card" : activeTab === "copy" || activeTab === "linkedin" ? "Copy Details & Open" : `Continue to ${currentTab?.label}`}
                    </button>
                </div>
            </div>
            <style>{`
                .invite-v2-tabs::-webkit-scrollbar { display: none; }
                .banner-spinner {
                    width: 24px;
                    height: 24px;
                    border: 2.5px solid rgba(255,255,255,0.2);
                    border-top-color: #38bdf8;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>,
        document.body
    );
};

const arrowStyle = {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "32px",
    background: "var(--color-surface, #0f172a)",
    border: "none",
    color: "var(--color-text, #fff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 2,
    transition: "all 0.2s",
    opacity: 1,
    boxShadow: "0 0 10px rgba(0,0,0,0.5)"
};

const DownloadIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const WhatsAppIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-10.8 8.38 8.38 0 0 1 3.8.9L21 4.5l-1.4 5.9Z"></path>
    </svg>
);

const TelegramIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

const LinkedInIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0077B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
        <rect x="2" y="9" width="4" height="12"></rect>
        <circle cx="4" cy="4" r="2"></circle>
    </svg>
);

const CopyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

export default memo(SharePulseModal);
