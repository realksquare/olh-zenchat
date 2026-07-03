import { useState, useEffect } from "react";

const quotes = {
    zero: [
        "Zero minutes. Did you actually go outside today, or is your phone just dead?",
        "No messages. Your friends must be enjoying the peace and quiet.",
        "0 minutes. The social media databases are wondering if you still exist."
    ],
    veryLow: [
        "Only {m}m spent. A quick text-and-dash. Efficient, or just avoiding everyone?",
        "Under 5 minutes. You came, you replied, you vanished. Respectable boundary setting."
    ],
    low: [
        "{m}m spent. Enough to prove you are social, but not enough to ruin your afternoon.",
        "{m}m. An actual human connection. Shocking, isn't it?"
    ],
    medium: [
        "{m}m. Quite a long talk. Are you gossiping or planning a revolution?",
        "Almost an hour. Remember, real life is in high-definition and does not require Wi-Fi."
    ],
    high: [
        "{h}h {m}m. Go look at some grass. Seriously. It's green and does not send push notifications.",
        "{h}h {m}m. You've officially spent more time talking than a Trappist monk does in a year."
    ]
};

const getSarcasticQuote = (minutes) => {
    let list = quotes.zero;
    if (minutes > 60) list = quotes.high;
    else if (minutes > 20) list = quotes.medium;
    else if (minutes > 5) list = quotes.low;
    else if (minutes > 0) list = quotes.veryLow;

    const idx = Math.floor(Math.abs(Math.sin(minutes || 1)) * list.length) % list.length;
    const template = list[idx];

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return template.replace("{h}", h).replace("{m}", m);
};

const ZenTimeDashboard = ({ snapTo }) => {
    const [minutes, setMinutes] = useState(0);

    const loadDailyTime = () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const stored = localStorage.getItem("zenchat_daily_tracker");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.date === todayStr) {
                    setMinutes(parsed.minutes || 0);
                    return;
                }
            }
            setMinutes(0);
        } catch (e) {
            setMinutes(0);
        }
    };

    useEffect(() => {
        loadDailyTime();

        const handleUpdate = (e) => {
            if (typeof e.detail === "number") {
                setMinutes(e.detail);
            }
        };

        window.addEventListener("zenchat-daily-time-updated", handleUpdate);
        return () => window.removeEventListener("zenchat-daily-time-updated", handleUpdate);
    }, []);

    const openDetails = (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("open-time-dashboard"));
    };

    // Calculations based on minutes
    const gigDataMB = minutes * 2.50;
    const zenDataMB = minutes * 0.03;
    const netSavedMB = Math.max(0, gigDataMB - zenDataMB);

    const tiktokVideos = minutes * 4;
    const adsViewed = Math.floor(minutes / 3);

    const formatData = (mb) => {
        if (mb >= 1024) {
            return `${(mb / 1024).toFixed(1)} GB`;
        }
        return `${mb.toFixed(1)} MB`;
    };

    // Calculate progress fill percentage (max comparison bound is 250MB)
    const fillPercent = Math.min(100, (netSavedMB / 250) * 100);

    return (
        <div className="zen-time-dashboard-container" onClick={openDetails}>
            <div className="editorial-main-time">
                <span className="editorial-time-val">
                    {Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)}h ` : ""}{minutes % 60}m
                </span>
                <span className="editorial-time-lbl">spent in conversation today</span>
            </div>

            <div className="editorial-narrative">
                <p className="editorial-quote">
                    "{getSarcasticQuote(minutes)}"
                </p>
                {minutes > 0 ? (
                    <p className="editorial-comparison">
                        By choosing ZenChat over typical social feeds, you saved <strong className="highlight-metric">{formatData(netSavedMB)}</strong> of network load, and avoided scrolling past <strong className="highlight-metric">{tiktokVideos} videos</strong> and <strong className="highlight-metric">{adsViewed} ads</strong>.
                    </p>
                ) : (
                    <p className="editorial-comparison zero-state-comparison">
                        So far, you've saved <strong>0 MB</strong> of data because you haven't chatted today. Go ahead, break the ice, or enjoy the silent pause.
                    </p>
                )}
            </div>

            {minutes > 0 && (
                <div className="editorial-savings-bar">
                    <div className="editorial-bar-label">
                        <span>DATA FOOTPRINT SAVED</span>
                        <span className="savings-val">+{formatData(netSavedMB)}</span>
                    </div>
                    <div className="editorial-bar-track">
                        <div className="editorial-bar-fill" style={{ width: `${fillPercent}%` }} />
                    </div>
                </div>
            )}

            <div className="editorial-nudge" onClick={(e) => { e.stopPropagation(); snapTo('mid'); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="nudge-icon">
                    <polyline points="18 15 12 9 6 15" />
                </svg>
                <span>{minutes === 0 ? "Pull up chats to start connecting" : "View Detailed Analytics"}</span>
            </div>
        </div>
    );
};

export default ZenTimeDashboard;
