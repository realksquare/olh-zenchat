import { useState, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import axiosInstance from "../../utils/axios";
import { generateBurnerSecretKey } from "../../utils/burnerCrypto";

const BurnerBridgeModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState("create"); // 'create' | 'active'
    const [durationHours, setDurationHours] = useState(24);
    const [maxMessages, setMaxMessages] = useState(0); // 0 = unlimited
    const [creatorAlias, setCreatorAlias] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedLink, setGeneratedLink] = useState("");
    const [generatedToken, setGeneratedToken] = useState("");
    const [activeBridges, setActiveBridges] = useState([]);
    const [isLoadingBridges, setIsLoadingBridges] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(""), 2800);
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            fetchActiveBridges();
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [isOpen]);

    const fetchActiveBridges = async () => {
        setIsLoadingBridges(true);
        try {
            const res = await axiosInstance.get("/burner/my-bridges");
            if (res.data?.success) {
                setActiveBridges(res.data.bridges || []);
            }
        } catch (err) {
            console.error("[Burner] Error fetching bridges:", err);
        } finally {
            setIsLoadingBridges(false);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            // 1. Generate client-side AES-256-GCM symmetric key
            const secretKeyHex = await generateBurnerSecretKey();

            // 2. Register bridge session on server
            const res = await axiosInstance.post("/burner/create", {
                durationHours,
                maxMessages,
                creatorAlias: creatorAlias.trim() || undefined,
            });

            if (res.data?.success && res.data.bridge?.bridgeToken) {
                const token = res.data.bridge.bridgeToken;
                // Store secretKey in sessionStorage for host convenience
                sessionStorage.setItem(`burner_key_${token}`, secretKeyHex);

                const fullUrl = `${window.location.origin}/burner/${token}#${secretKeyHex}`;
                setGeneratedLink(fullUrl);
                setGeneratedToken(token);
                showToast("Burner link ready to share");
                fetchActiveBridges();
            }
        } catch (err) {
            console.error("[Burner] Failed to generate bridge:", err);
            showToast("Failed to create burner bridge");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (textToCopy) => {
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy);
        showToast("Burner link copied to clipboard");
    };

    const handleBurnBridge = async (token) => {
        try {
            await axiosInstance.post(`/burner/${token}/burn`);
            sessionStorage.removeItem(`burner_key_${token}`);
            showToast("Bridge incinerated into ash");
            if (generatedToken === token) {
                setGeneratedLink("");
                setGeneratedToken("");
            }
            fetchActiveBridges();
        } catch (err) {
            console.error("[Burner] Failed to burn bridge:", err);
            showToast("Failed to burn bridge");
        }
    };

    const formatCountdown = (expiresAt) => {
        const diff = new Date(expiresAt) - new Date();
        if (diff <= 0) return "Expired";
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${mins}m left`;
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay moments-aura-overlay" style={{ zIndex: 10000 }} onClick={onClose}>
            {toastMessage && (
                <div className="zen-toast zen-toast-success" style={{ pointerEvents: "none" }}>
                    {toastMessage}
                </div>
            )}

            <div
                className="moments-aura-content burner-modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ width: "480px", maxWidth: "95%", padding: 0 }}
            >
                {/* Header */}
                <div className="moments-aura-header" style={{ padding: "18px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                            style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "10px",
                                background: "rgba(249, 115, 22, 0.15)",
                                border: "1px solid rgba(249, 115, 22, 0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#f97316",
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="moments-aura-title" style={{ fontSize: "1.15rem", margin: 0 }}>
                                Burner Bridge
                            </h2>
                            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                                Zero-login, 24h self-destructing E2EE chats
                            </span>
                        </div>
                    </div>
                    <button className="aura-close-btn" onClick={onClose} aria-label="Close">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Subnav Tabs */}
                <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)" }}>
                    <button
                        onClick={() => setActiveTab("create")}
                        style={{
                            flex: 1,
                            padding: "12px",
                            background: "transparent",
                            border: "none",
                            borderBottom: activeTab === "create" ? "2px solid #f97316" : "2px solid transparent",
                            color: activeTab === "create" ? "#f97316" : "#94a3b8",
                            fontWeight: "600",
                            fontSize: "0.88rem",
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                    >
                        Create Bridge
                    </button>
                    <button
                        onClick={() => setActiveTab("active")}
                        style={{
                            flex: 1,
                            padding: "12px",
                            background: "transparent",
                            border: "none",
                            borderBottom: activeTab === "active" ? "2px solid #f97316" : "2px solid transparent",
                            color: activeTab === "active" ? "#f97316" : "#94a3b8",
                            fontWeight: "600",
                            fontSize: "0.88rem",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                        }}
                    >
                        Active Bridges
                        {activeBridges.length > 0 && (
                            <span style={{ background: "rgba(249,115,22,0.2)", color: "#f97316", padding: "1px 7px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: "700" }}>
                                {activeBridges.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab Content */}
                <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
                    {activeTab === "create" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            {/* Privacy Notice Banner */}
                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "12px",
                                    background: "rgba(249, 115, 22, 0.08)",
                                    border: "1px solid rgba(249, 115, 22, 0.2)",
                                    fontSize: "0.82rem",
                                    color: "#fdba74",
                                    lineHeight: "1.5",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "10px",
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: "2px" }}>
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <span>
                                    <strong>True Zero-Knowledge:</strong> The recipient opens the link in their browser without signing up. The encryption key lives only in the URL hash fragment and is never sent to the server.
                                </span>
                            </div>

                            {/* Lifetime Options */}
                            <div>
                                <label style={{ fontSize: "0.82rem", color: "#cbd5e1", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                                    Auto-Burn Lifetime
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                    {[
                                        { label: "1 Hour", val: 1 },
                                        { label: "8 Hours", val: 8 },
                                        { label: "24 Hours", val: 24 },
                                    ].map((opt) => (
                                        <button
                                            key={opt.val}
                                            type="button"
                                            onClick={() => setDurationHours(opt.val)}
                                            style={{
                                                padding: "10px",
                                                borderRadius: "10px",
                                                border: durationHours === opt.val ? "1px solid #f97316" : "1px solid rgba(255,255,255,0.08)",
                                                background: durationHours === opt.val ? "rgba(249, 115, 22, 0.15)" : "rgba(255,255,255,0.03)",
                                                color: durationHours === opt.val ? "#f97316" : "#94a3b8",
                                                fontWeight: "600",
                                                fontSize: "0.85rem",
                                                cursor: "pointer",
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Max Messages Limit */}
                            <div>
                                <label style={{ fontSize: "0.82rem", color: "#cbd5e1", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                                    Message Limit
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                    {[
                                        { label: "Unlimited", val: 0 },
                                        { label: "25 Msgs", val: 25 },
                                        { label: "50 Msgs", val: 50 },
                                    ].map((opt) => (
                                        <button
                                            key={opt.val}
                                            type="button"
                                            onClick={() => setMaxMessages(opt.val)}
                                            style={{
                                                padding: "10px",
                                                borderRadius: "10px",
                                                border: maxMessages === opt.val ? "1px solid #f97316" : "1px solid rgba(255,255,255,0.08)",
                                                background: maxMessages === opt.val ? "rgba(249, 115, 22, 0.15)" : "rgba(255,255,255,0.03)",
                                                color: maxMessages === opt.val ? "#f97316" : "#94a3b8",
                                                fontWeight: "600",
                                                fontSize: "0.85rem",
                                                cursor: "pointer",
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Creator Alias Input */}
                            <div>
                                <label style={{ fontSize: "0.82rem", color: "#cbd5e1", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                                    Display Name for Guest (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. ZenHost or your name"
                                    value={creatorAlias}
                                    onChange={(e) => setCreatorAlias(e.target.value)}
                                    maxLength={24}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        borderRadius: "10px",
                                        background: "rgba(0,0,0,0.25)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#f8fafc",
                                        fontSize: "0.9rem",
                                        boxSizing: "border-box",
                                        outline: "none",
                                    }}
                                />
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    borderRadius: "12px",
                                    background: "#f97316",
                                    border: "none",
                                    color: "#ffffff",
                                    fontWeight: "600",
                                    fontSize: "0.95rem",
                                    cursor: isGenerating ? "not-allowed" : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    transition: "opacity 0.2s",
                                    opacity: isGenerating ? 0.7 : 1,
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                {isGenerating ? "Generating Secure Bridge..." : "Generate Burner Link"}
                            </button>

                            {/* Generated Link Display */}
                            {generatedLink && (
                                <div
                                    style={{
                                        marginTop: "4px",
                                        padding: "16px",
                                        borderRadius: "14px",
                                        background: "rgba(0,0,0,0.3)",
                                        border: "1px solid rgba(249, 115, 22, 0.3)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "12px",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: "0.78rem", color: "#f97316", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            Burner Link Ready
                                        </span>
                                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                            Self-destructs in {durationHours}h
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: "8px",
                                            background: "rgba(0,0,0,0.4)",
                                            fontSize: "0.8rem",
                                            color: "#e2e8f0",
                                            wordBreak: "break-all",
                                            fontFamily: "monospace",
                                            lineHeight: "1.4",
                                        }}
                                    >
                                        {generatedLink}
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                        <button
                                            onClick={() => handleCopy(generatedLink)}
                                            style={{
                                                padding: "10px",
                                                borderRadius: "10px",
                                                background: "rgba(249, 115, 22, 0.15)",
                                                border: "1px solid rgba(249, 115, 22, 0.35)",
                                                color: "#f97316",
                                                fontWeight: "600",
                                                fontSize: "0.85rem",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "6px",
                                            }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            Copy Link
                                        </button>
                                        <button
                                            onClick={() => {
                                                window.open(generatedLink, "_blank");
                                            }}
                                            style={{
                                                padding: "10px",
                                                borderRadius: "10px",
                                                background: "#3b82f6",
                                                border: "none",
                                                color: "#ffffff",
                                                fontWeight: "600",
                                                fontSize: "0.85rem",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "6px",
                                            }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                <polyline points="15 3 21 3 21 9" />
                                                <line x1="10" y1="14" x2="21" y2="3" />
                                            </svg>
                                            Open Bridge
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {isLoadingBridges ? (
                                <div style={{ textAlign: "center", padding: "28px", color: "#94a3b8", fontSize: "0.9rem" }}>
                                    Loading your active bridges...
                                </div>
                            ) : activeBridges.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "32px 16px", color: "#64748b" }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 10px", opacity: 0.6 }}>
                                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                    </svg>
                                    <div style={{ fontWeight: "600", color: "#94a3b8", marginBottom: "4px" }}>No Active Burner Bridges</div>
                                    <div style={{ fontSize: "0.82rem" }}>Generate a bridge to start a disposable guest session.</div>
                                </div>
                            ) : (
                                activeBridges.map((b) => {
                                    const cachedKey = sessionStorage.getItem(`burner_key_${b.bridgeToken}`);
                                    const fullUrl = cachedKey ? `${window.location.origin}/burner/${b.bridgeToken}#${cachedKey}` : `${window.location.origin}/burner/${b.bridgeToken}`;

                                    return (
                                        <div
                                            key={b.id || b.bridgeToken}
                                            style={{
                                                padding: "16px",
                                                borderRadius: "14px",
                                                background: "rgba(255,255,255,0.03)",
                                                border: "1px solid rgba(255,255,255,0.07)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "10px",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: b.guestConnected ? "#10b981" : "#f59e0b" }} />
                                                    <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f8fafc" }}>
                                                        {b.guestConnected ? `Guest: ${b.guestAlias}` : "Waiting for guest to join"}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: "0.75rem", color: "#f97316", fontWeight: "600" }}>
                                                    {formatCountdown(b.expiresAt)}
                                                </span>
                                            </div>

                                            <div style={{ fontSize: "0.78rem", color: "#94a3b8", display: "flex", gap: "14px" }}>
                                                <span>Messages: {b.messageCount} {b.maxMessages > 0 ? `/ ${b.maxMessages}` : ""}</span>
                                                <span>Host: {b.creatorAlias}</span>
                                            </div>

                                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                                {cachedKey && (
                                                    <button
                                                        onClick={() => handleCopy(fullUrl)}
                                                        style={{
                                                            flex: 1,
                                                            padding: "8px",
                                                            borderRadius: "8px",
                                                            background: "rgba(255,255,255,0.05)",
                                                            border: "1px solid rgba(255,255,255,0.1)",
                                                            color: "#cbd5e1",
                                                            fontSize: "0.8rem",
                                                            fontWeight: "500",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Copy Link
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => window.open(fullUrl, "_blank")}
                                                    style={{
                                                        flex: 1,
                                                        padding: "8px",
                                                        borderRadius: "8px",
                                                        background: "rgba(59, 130, 246, 0.15)",
                                                        border: "1px solid rgba(59, 130, 246, 0.3)",
                                                        color: "#60a5fa",
                                                        fontSize: "0.8rem",
                                                        fontWeight: "600",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Open Chat
                                                </button>
                                                <button
                                                    onClick={() => handleBurnBridge(b.bridgeToken)}
                                                    style={{
                                                        padding: "8px 12px",
                                                        borderRadius: "8px",
                                                        background: "rgba(239, 68, 68, 0.15)",
                                                        border: "1px solid rgba(239, 68, 68, 0.3)",
                                                        color: "#f87171",
                                                        fontSize: "0.8rem",
                                                        fontWeight: "600",
                                                        cursor: "pointer",
                                                    }}
                                                    title="Incinerate and wipe now"
                                                >
                                                    Burn Now
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(BurnerBridgeModal);
