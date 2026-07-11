import { useState, useEffect } from "react";
import "./ConnectionHeatmap.css";

const getIntensity = (minutes) => {
    if (!minutes || minutes === 0) return 0;
    if (minutes < 5) return 1;
    if (minutes < 20) return 2;
    if (minutes < 60) return 3;
    return 4;
};

const ConnectionHeatmap = () => {
    const [history, setHistory] = useState({});
    const [selectedDate, setSelectedDate] = useState(null);
    
    const loadHistory = () => {
        try {
            const stored = localStorage.getItem("zenchat_historical_tracker");
            let data = {};
            if (stored) {
                data = JSON.parse(stored);
            }
            // Merge today's minutes from daily tracker
            const dailyStored = localStorage.getItem("zenchat_daily_tracker");
            if (dailyStored) {
                const dailyParsed = JSON.parse(dailyStored);
                const todayStr = new Date().toISOString().split('T')[0];
                if (dailyParsed.date === todayStr) {
                    data[todayStr] = dailyParsed.minutes || 0;
                }
            }
            setHistory(data);
        } catch (e) {
            console.error("Failed to load historical tracker:", e);
        }
    };

    useEffect(() => {
        loadHistory();
        
        const handleUpdate = () => {
            loadHistory();
        };
        
        window.addEventListener("zenchat-daily-time-updated", handleUpdate);
        return () => window.removeEventListener("zenchat-daily-time-updated", handleUpdate);
    }, []);

    // Generate last 28 days including today
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize

    // We want to display a 4x7 grid (28 days).
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isTodayEmpty = !(history[todayStr] > 0);

    const handleCellClick = (dateStr) => {
        const mins = history[dateStr] || 0;
        if (mins > 0) {
            setSelectedDate(dateStr);
        }
    };

    const getStatData = (dateStr) => {
        const mins = history[dateStr] || 0;
        // 0.45MB per minute estimated E2EE compression savings
        const saved = (mins * 0.45).toFixed(2);
        // Format date nicely
        const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
        const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', options);
        return {
            minutes: mins,
            saved,
            formattedDate
        };
    };

    const stats = selectedDate ? getStatData(selectedDate) : null;

    return (
        <div className="connection-heatmap-container">
            <div className="heatmap-header">
                <span className="heatmap-title">Connection Consistency</span>
                <span className="heatmap-subtitle">Last 4 Weeks</span>
            </div>
            
            <div className="heatmap-body-wrapper" style={{ position: "relative" }}>
                <div className={`heatmap-grid ${isTodayEmpty ? 'is-blurred' : ''}`}>
                    {days.map((dateStr) => {
                        const mins = history[dateStr] || 0;
                        const intensity = getIntensity(mins);
                        
                        return (
                            <div 
                                key={dateStr} 
                                className={`heatmap-cell intensity-${intensity}`}
                                title={`${mins} minutes on ${dateStr}`}
                                onClick={() => handleCellClick(dateStr)}
                            />
                        );
                    })}
                </div>

                {isTodayEmpty && (
                    <div className="heatmap-empty-overlay">
                        <span className="empty-overlay-text">Start your first conversation for today</span>
                    </div>
                )}
            </div>
            
            <div className="heatmap-legend">
                <span>Less</span>
                <div className="legend-cells">
                    <div className="heatmap-cell intensity-0" />
                    <div className="heatmap-cell intensity-1" />
                    <div className="heatmap-cell intensity-2" />
                    <div className="heatmap-cell intensity-3" />
                    <div className="heatmap-cell intensity-4" />
                </div>
                <span>More</span>
            </div>

            {selectedDate && stats && (
                <div className="heatmap-day-modal-overlay" onClick={() => setSelectedDate(null)}>
                    <div className="heatmap-day-modal-card" onClick={(e) => e.stopPropagation()}>
                        <button className="heatmap-modal-close" onClick={() => setSelectedDate(null)}>&times;</button>
                        <h4 className="heatmap-modal-date">{stats.formattedDate}</h4>
                        <div className="heatmap-modal-stat-row">
                            <span className="heatmap-modal-stat-label">Convo Duration:</span>
                            <span className="heatmap-modal-stat-value">{stats.minutes} mins</span>
                        </div>
                        <div className="heatmap-modal-stat-row">
                            <span className="heatmap-modal-stat-label">Data Saved:</span>
                            <span className="heatmap-modal-stat-value" style={{ color: "#10b981" }}>{stats.saved} MB</span>
                        </div>
                        <div style={{ marginTop: "16px", fontSize: "0.78rem", color: "var(--color-text-muted, #94a3b8)", fontStyle: "italic", textAlign: "center" }}>
                            * Data saved by avoiding uncompressed messaging scripts and heavy trackers.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConnectionHeatmap;
