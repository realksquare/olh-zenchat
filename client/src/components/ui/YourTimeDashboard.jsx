import { useState, useEffect, useRef } from "react";
import axiosInstance from "../../utils/axios";
import { createPortal } from "react-dom";

const ContactDropdown = ({ options, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selected = options.find(o => o.value === value) || options[0];

    return (
        <div ref={ref} style={{ position: "relative", minWidth: "140px" }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    width: "100%",
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    color: "#e2e8f0",
                    padding: "7px 12px",
                    fontSize: "0.88rem",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                    whiteSpace: "nowrap",
                    maxWidth: "180px",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                }}
            >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selected?.label || "Global"}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {open && (
                <div style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    minWidth: "180px",
                    maxWidth: "220px",
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    padding: "6px",
                    zIndex: 200,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    maxHeight: "220px",
                    overflowY: "auto"
                }}>
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "9px 12px",
                                borderRadius: "8px",
                                border: "none",
                                background: opt.value === value ? "rgba(168, 85, 247, 0.15)" : "transparent",
                                color: opt.value === value ? "#e9d5ff" : "#cbd5e1",
                                fontSize: "0.88rem",
                                fontWeight: opt.value === value ? "600" : "400",
                                cursor: "pointer",
                                transition: "background 0.15s",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}
                            onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                            onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = "transparent"; }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const YourTimeDashboard = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedContact, setSelectedContact] = useState("all");

    useEffect(() => {
        if (!isOpen) return;
        const fetchStats = async () => {
            setLoading(true);
            try {
                const { data } = await axiosInstance.get("/analytics/my-time");
                if (data.success) {
                    setStats(data);
                }
            } catch (err) {
                console.error("Failed to load time stats:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [isOpen]);

    if (!isOpen) return null;

    const renderActiveTime = () => {
        if (!stats) return null;
        const activeTime = stats.activeTime;
        const perContact = activeTime.perContact || [];

        const dropdownOptions = [
            { value: "all", label: "Global" },
            ...perContact.map(c => ({ value: c.contactId, label: c.username }))
        ];

        let displayMinutes = activeTime.global;
        let displayName = "Global Active Chatting Time";

        if (selectedContact !== "all") {
            const cInfo = perContact.find(c => c.contactId === selectedContact);
            if (cInfo) {
                displayMinutes = cInfo.minutes;
                displayName = `Chatting with ${cInfo.username}`;
            } else {
                displayMinutes = 0;
            }
        }

        const hrs = Math.floor(displayMinutes / 60);
        const mins = displayMinutes % 60;

        return (
            <div className="analytics-card" style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.1rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Active Chatting Time
                    </h3>
                    <ContactDropdown
                        options={dropdownOptions}
                        value={selectedContact}
                        onChange={setSelectedContact}
                    />
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "2.5rem", fontWeight: "700", color: "#38bdf8", letterSpacing: "-1px" }}>
                        {hrs > 0 ? `${hrs}h ` : ""}{mins}m
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>{selectedContact === "all" ? "total time actively engaged" : `with ${displayName.replace("Chatting with ", "")}`}</span>
                </div>
                <div style={{ padding: "10px 14px", background: "rgba(56, 189, 248, 0.08)", borderRadius: "10px", border: "1px solid rgba(56, 189, 248, 0.15)", color: "#7dd3fc", fontSize: "0.85rem", fontStyle: "italic" }}>
                    "{selectedContact === "all" ? activeTime.tagline : "Quality time spent building a connection."}"
                </div>
            </div>
        );
    };

    const renderMoments = () => {
        if (!stats) return null;
        const m = stats.moments;
        return (
            <div className="analytics-card">
                <h3 style={{ margin: "0 0 16px 0", color: "#f8fafc", fontSize: "1.1rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
                    </svg>
                    Moments Shared vs. Consumed
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                    <div className="stat-box">
                        <div className="stat-val" style={{ color: "#fbbf24" }}>{m.shared}</div>
                        <div className="stat-lbl">Shared</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-val" style={{ color: "#94a3b8" }}>{m.viewed}</div>
                        <div className="stat-lbl">Viewed</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-val" style={{ color: "#f43f5e" }}>{m.liked}</div>
                        <div className="stat-lbl">Liked (Others)</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-val" style={{ color: "#ec4899" }}>{m.likesReceived}</div>
                        <div className="stat-lbl">Likes Received</div>
                    </div>
                </div>
                <div style={{ padding: "10px 14px", background: "rgba(251, 191, 36, 0.08)", borderRadius: "10px", border: "1px solid rgba(251, 191, 36, 0.15)", color: "#fcd34d", fontSize: "0.85rem", fontStyle: "italic" }}>
                    "{m.tagline}"
                </div>
            </div>
        );
    };

    const renderDataSaved = () => {
        if (!stats) return null;
        const ds = stats.dataSaved;
        return (
            <div className="analytics-card">
                <h3 style={{ margin: "0 0 16px 0", color: "#f8fafc", fontSize: "1.1rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    Data &amp; Footprint Saved
                </h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "2rem", fontWeight: "700", color: "#22c55e", letterSpacing: "-1px" }}>
                        {ds.gbSaved}
                    </span>
                    <span style={{ color: "#86efac", fontSize: "1.1rem", fontWeight: "600" }}>GB</span>
                </div>
                <p style={{ margin: "0 0 16px 0", color: "#94a3b8", fontSize: "0.85rem", lineHeight: "1.5" }}>
                    Estimated data saved vs Instagram/TikTok usage during the same time period. <br />
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>* {ds.source}</span>
                </p>
                <div style={{ padding: "10px 14px", background: "rgba(34, 197, 94, 0.08)", borderRadius: "10px", border: "1px solid rgba(34, 197, 94, 0.15)", color: "#86efac", fontSize: "0.85rem", fontStyle: "italic" }}>
                    "{ds.tagline}"
                </div>
            </div>
        );
    };

    const renderLeaderboard = () => {
        if (!stats) return null;
        const lb = stats.leaderboard || [];
        return (
            <div className="analytics-card" style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#f8fafc", fontSize: "1.1rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    Active Time Leaderboard
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {lb.map((user, index) => {
                        const hrs = Math.floor(user.activeTimeMinutes / 60);
                        const mins = user.activeTimeMinutes % 60;
                        return (
                            <div key={user.userId} style={{
                                display: "flex", alignItems: "center", padding: "12px",
                                background: user.isMe ? "rgba(168, 85, 247, 0.1)" : "rgba(255, 255, 255, 0.02)",
                                borderRadius: "12px", border: user.isMe ? "1px solid rgba(168, 85, 247, 0.3)" : "1px solid rgba(255, 255, 255, 0.05)"
                            }}>
                                <div style={{ width: "24px", color: index < 3 ? "#a855f7" : "#64748b", fontWeight: "700", fontSize: "1rem" }}>
                                    #{index + 1}
                                </div>
                                <div className="avatar avatar-sm" style={{ margin: "0 12px" }}>
                                    {user.avatar ? <img src={user.avatar} alt={user.username} /> : <span>{user.username.slice(0, 2).toUpperCase()}</span>}
                                </div>
                                <div style={{ flex: 1, color: user.isMe ? "#e9d5ff" : "#e2e8f0", fontWeight: "500" }}>
                                    {user.username} {user.isMe && "(You)"}
                                </div>
                                <div style={{ color: "#94a3b8", fontSize: "0.9rem", fontWeight: "600" }}>
                                    {hrs > 0 ? `${hrs}h ` : ""}{mins}m
                                </div>
                            </div>
                        );
                    })}
                    {lb.length === 1 && (
                        <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "0.9rem" }}>
                            Add contacts to see how you rank among your friends!
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return createPortal(
        <div className="modal-overlay" style={{ zIndex: 100000, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="modal-card" style={{ maxWidth: "800px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, background: "var(--color-surface, rgba(15, 23, 42, 0.95))", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ margin: 0, color: "#f8fafc", fontSize: "1.3rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "10px" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Your Time on ZenChat
                    </h2>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px", color: "#64748b" }}>
                            <div className="spinner" style={{ width: "30px", height: "30px", border: "3px solid rgba(168, 85, 247, 0.2)", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "20px"
                        }}>
                            {renderActiveTime()}
                            {renderMoments()}
                            {renderDataSaved()}
                            {renderLeaderboard()}
                        </div>
                    )}
                </div>

                <style>{`
                    .analytics-card {
                        background: rgba(255, 255, 255, 0.02);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        border-radius: 16px;
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                    }
                    .stat-box {
                        background: rgba(0, 0, 0, 0.2);
                        border-radius: 12px;
                        padding: 12px;
                        text-align: center;
                        border: 1px solid rgba(255, 255, 255, 0.02);
                    }
                    .stat-val {
                        font-size: 1.5rem;
                        font-weight: 700;
                        margin-bottom: 4px;
                    }
                    .stat-lbl {
                        font-size: 0.75rem;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        font-weight: 600;
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
};

export default YourTimeDashboard;
