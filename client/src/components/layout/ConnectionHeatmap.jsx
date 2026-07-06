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
    
    const loadHistory = () => {
        try {
            const stored = localStorage.getItem("zenchat_historical_tracker");
            if (stored) {
                setHistory(JSON.parse(stored));
            }
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

    return (
        <div className="connection-heatmap-container">
            <div className="heatmap-header">
                <span className="heatmap-title">Connection Consistency</span>
                <span className="heatmap-subtitle">Last 4 Weeks</span>
            </div>
            
            <div className="heatmap-body-wrapper">
                <div className={`heatmap-body-content ${isTodayEmpty ? 'is-blurred' : ''}`}>
                    <div className="heatmap-grid">
                        {days.map((dateStr) => {
                            const mins = history[dateStr] || 0;
                            const intensity = getIntensity(mins);
                            
                            return (
                                <div 
                                    key={dateStr} 
                                    className={`heatmap-cell intensity-${intensity}`}
                                    title={`${mins} minutes on ${dateStr}`}
                                />
                            );
                        })}
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
                </div>

                {isTodayEmpty && (
                    <div className="heatmap-empty-overlay">
                        <span className="empty-overlay-text">Start your first conversation for today</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionHeatmap;
