import { useState, useEffect } from "react";

const grammar = {
    zero: [
        "{greeting} {zeroAction} {zeroBurn}",
        "{zeroBurn} {zeroAction}",
    ],
    veryLow: [
        "{greeting} {veryLowAction} {veryLowBurn}",
    ],
    low: [
        "{greeting} {lowAction} {lowBurn}",
    ],
    medium: [
        "{mediumAction} {mediumBurn}",
        "{greeting} {mediumAction} {mediumBurn}"
    ],
    high: [
        "{highAction} {highBurn}",
        "Wow. {highAction} {highBurn}"
    ]
};

const fragments = {
    greeting: ["Oh look,", "Well well,", "Ah,", "Impressive.", "See that?"],
    zeroAction: ["0 minutes so far.", "Still at zero.", "Not a single minute logged."],
    zeroBurn: ["Did your phone die?", "Avoiding people today?", "The ultimate ghost mode.", "Who are you hiding from?"],
    veryLowAction: ["Only {m}m spent.", "A brief {m}m visit.", "Just {m}m so far."],
    veryLowBurn: ["Efficient or just lonely?", "Text and dash.", "Setting some serious boundaries.", "Not sticking around, huh?"],
    lowAction: ["{m}m of socializing.", "{m}m on the clock.", "You survived {m}m here."],
    lowBurn: ["Enough to prove you exist.", "An actual human connection?", "Don't get too crazy now.", "Pacing yourself, I see."],
    mediumAction: ["{h}h {m}m? That's quite a chat.", "Clocking in at {h}h {m}m.", "You've been here for {h}h {m}m."],
    mediumBurn: ["Gossiping or planning a heist?", "The real world called, it left a voicemail.", "Remember what fresh air feels like?", "You're practically a local now."],
    highAction: ["{h}h {m}m?!", "A staggering {h}h {m}m.", "You hit {h}h {m}m of screen time."],
    highBurn: ["Go touch some grass.", "Your retinas are begging for mercy.", "Did you forget you have legs?", "I think it's time to log off."]
};

const prng = (seed) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const pick = (arr, seed) => arr[Math.floor(prng(seed) * arr.length)];

const getSarcasticQuote = (minutes) => {
    const today = new Date().getDate();
    const seed = minutes + today * 1000;

    let category = "zero";
    if (minutes > 60) category = "high";
    else if (minutes > 20) category = "medium";
    else if (minutes > 5) category = "low";
    else if (minutes > 0) category = "veryLow";

    let template = pick(grammar[category], seed);
    
    let iterations = 0;
    while (template.includes("{") && iterations < 10) {
        template = template.replace(/\{(\w+)\}/g, (match, key) => {
            if (fragments[key]) {
                const localSeed = seed + key.charCodeAt(0) + iterations;
                return pick(fragments[key], localSeed);
            }
            return match;
        });
        iterations++;
    }

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let res = template.replace(/\{h\}/g, h).replace(/\{m\}/g, m);
    // cleanup double spaces and capitalize first letter
    res = res.replace(/\s+/g, ' ').trim();
    return res.charAt(0).toUpperCase() + res.slice(1);
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                </svg>
                <span>{minutes === 0 ? "Pull up the panel below to access chats" : "View Detailed Analytics"}</span>
            </div>
        </div>
    );
};

export default ZenTimeDashboard;
