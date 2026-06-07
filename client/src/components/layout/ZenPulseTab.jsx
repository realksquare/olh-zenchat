import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "../../stores/authStore";
import { usePulseStore } from "../../stores/pulseStore";

const ActivityIcon = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
);

const FlameIcon = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
    </svg>
);

const CheckCircleIcon = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const ShareIcon = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>
);

const ChevronDownIcon = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);

const ChevronUpIcon = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
);

const ZenPulseTab = () => {
    const user = useAuthStore(s => s.user);
    const { 
        todayQuestion, 
        yesterdayQuestion, 
        myVote, 
        streak, 
        votedQuestionIds,
        history,
        historyHasMore,
        historyPage,
        fetchToday, 
        fetchYesterday, 
        fetchMyStatus,
        fetchHistory,
        submitAuthVote,
        isLoading
    } = usePulseStore();

    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [shareMsg, setShareMsg] = useState("");
    const canvasRef = useRef(null);

    useEffect(() => {
        fetchToday();
        fetchYesterday();
        fetchMyStatus();
    }, [fetchToday, fetchYesterday, fetchMyStatus]);

    const handleVote = async () => {
        if (!selectedOption || !todayQuestion) return;
        setIsSubmitting(true);
        await submitAuthVote(todayQuestion._id, selectedOption);
        setIsSubmitting(false);
    };

    const hasVotedToday = myVote?.questionId === todayQuestion?._id || votedQuestionIds.includes(todayQuestion?._id);

    // Share Card Generator
    const generateShareCard = async () => {
        if (!yesterdayQuestion) return null;
        
        const canvas = canvasRef.current;
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        canvas.width = 1080;
        canvas.height = 1080;

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ZenChat Branding
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 64px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ZenPulse', canvas.width / 2, 120);
        
        ctx.fillStyle = '#3b82f6';
        ctx.font = '500 36px "Inter", sans-serif';
        ctx.fillText('Daily Community Opinion', canvas.width / 2, 180);

        // Question
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px "Inter", sans-serif';
        
        const words = yesterdayQuestion.question.split(' ');
        let line = '';
        let y = 350;
        
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > 900 && n > 0) {
                ctx.fillText(line, canvas.width / 2, y);
                line = words[n] + ' ';
                y += 70;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, canvas.width / 2, y);

        // Top Answer / Highlight
        y += 120;
        let topOption = yesterdayQuestion.options[0];
        let maxCount = 0;
        yesterdayQuestion.options.forEach(opt => {
            const count = yesterdayQuestion.optionCounts?.[opt.id] || 0;
            if (count > maxCount) {
                maxCount = count;
                topOption = opt;
            }
        });

        const total = yesterdayQuestion.totalVotes || 1;
        const topPercentage = Math.round((maxCount / total) * 100);

        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 4;
        
        // Draw rounded rectangle for top answer
        const rectWidth = 800;
        const rectHeight = 140;
        const rectX = (canvas.width - rectWidth) / 2;
        const rectY = y;
        
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectWidth, rectHeight, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(topOption.text, rectX + 40, rectY + 85);
        
        ctx.fillStyle = '#60a5fa';
        ctx.textAlign = 'right';
        ctx.fillText(`${topPercentage}% agreed`, rectX + rectWidth - 40, rectY + 85);

        // Footer CTA
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 32px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Vote on today\'s pulse at', canvas.width / 2, 920);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px "Inter", sans-serif';
        ctx.fillText(`olh-zenchat.vercel.app/zenpulse?ref=${user.username}`, canvas.width / 2, 980);

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                resolve(blob);
            }, 'image/png');
        });
    };

    const handleShare = async () => {
        setShareMsg("Generating...");
        const blob = await generateShareCard();
        if (!blob) {
            setShareMsg("Failed to generate");
            return;
        }

        const file = new File([blob], 'zenpulse-results.png', { type: 'image/png' });
        const shareUrl = `https://olh-zenchat.vercel.app/zenpulse?ref=${user.username}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'ZenPulse Results',
                    text: `Check out the community opinion on ZenChat! Join using my link to vote on today's question: ${shareUrl}`,
                    files: [file]
                });
                setShareMsg("Shared!");
            } catch (err) {
                console.log("Share failed", err);
                downloadCard(blob);
            }
        } else {
            downloadCard(blob);
        }
        
        setTimeout(() => setShareMsg(""), 3000);
    };

    const downloadCard = (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zenpulse-${new Date().toISOString().split('T')[0]}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setShareMsg("Downloaded!");
    };

    const loadMoreHistory = () => {
        if (historyHasMore) {
            fetchHistory(historyPage + 1);
        }
    };

    return (
        <div className="zenpulse-tab-container">
            <div className="pulse-header-bar">
                <div className="logo-container">
                    <h2>ZenPulse</h2>
                </div>
                <div className="pulse-streak-badge">
                    <FlameIcon size={18} className={streak.current > 0 ? "active-flame" : ""} />
                    <span>{streak.current} day streak</span>
                </div>
            </div>

            <div className="pulse-scroll-area">
                {/* Active Question Section */}
                <div className="pulse-inapp-card active-card">
                    <div className="card-top-label">TODAY'S PULSE</div>
                    
                    {isLoading ? (
                        <div className="pulse-loading">Loading...</div>
                    ) : todayQuestion ? (
                        <>
                            <h3 className="pulse-inapp-question">{todayQuestion.question}</h3>
                            
                            {!hasVotedToday ? (
                                <div className="pulse-inapp-options">
                                    {todayQuestion.options.map(opt => (
                                        <button 
                                            key={opt.id}
                                            className={`pulse-opt-btn ${selectedOption === opt.id ? 'selected' : ''}`}
                                            onClick={() => setSelectedOption(opt.id)}
                                        >
                                            {opt.text}
                                        </button>
                                    ))}
                                    <button 
                                        className="btn btn-primary pulse-submit"
                                        disabled={!selectedOption || isSubmitting}
                                        onClick={handleVote}
                                    >
                                        {isSubmitting ? "Submitting..." : "Submit Vote"}
                                    </button>
                                </div>
                            ) : (
                                <div className="pulse-voted-state">
                                    <CheckCircleIcon size={32} className="voted-icon" />
                                    <h4>Vote cast successfully!</h4>
                                    <p>Results will be revealed tomorrow at 7 PM IST.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="pulse-empty">
                            <p>No active question right now.</p>
                        </div>
                    )}
                </div>

                {/* Yesterday's Results Section */}
                {yesterdayQuestion && (
                    <div className="pulse-inapp-card results-card">
                        <div className="card-top-label">YESTERDAY'S RESULTS</div>
                        <h3 className="pulse-inapp-question-small">{yesterdayQuestion.question}</h3>
                        
                        <div className="pulse-results-list">
                            {yesterdayQuestion.options.map(opt => {
                                const count = yesterdayQuestion.optionCounts?.[opt.id] || 0;
                                const total = yesterdayQuestion.totalVotes || 1;
                                const percentage = Math.round((count / total) * 100);
                                
                                return (
                                    <div key={opt.id} className="pulse-result-row">
                                        <div className="result-label-bar">
                                            <span className="result-text">{opt.text}</span>
                                            <span className="result-pct">{percentage}%</span>
                                        </div>
                                        <div className="result-progress-bg">
                                            <div className="result-progress-fill" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="results-footer">
                                <span className="total-votes">{yesterdayQuestion.totalVotes} votes</span>
                                
                                <button className="btn btn-outline share-pulse-btn" onClick={handleShare}>
                                    {shareMsg || (
                                        <>
                                            <ShareIcon size={16} /> Share Results
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hidden canvas for generating the share image */}
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                {/* History Section */}
                <div className="pulse-history-section">
                    <button 
                        className="history-toggle-btn" 
                        onClick={() => {
                            if (!showHistory && history.length === 0) fetchHistory(1);
                            setShowHistory(!showHistory);
                        }}
                    >
                        <span>Past Pulses</span>
                        {showHistory ? <ChevronUpIcon size={20} /> : <ChevronDownIcon size={20} />}
                    </button>
                    
                    {showHistory && (
                        <div className="history-list">
                            {history.length === 0 ? (
                                <p className="history-empty">No past pulses found.</p>
                            ) : (
                                history.map(q => (
                                    <div key={q._id} className="history-item">
                                        <div className="history-date">{new Date(q.revealedAt).toLocaleDateString()}</div>
                                        <div className="history-question">{q.question}</div>
                                        <div className="history-top-answer">
                                            Top: {q.options.reduce((prev, current) => 
                                                ((q.optionCounts?.[prev.id] || 0) > (q.optionCounts?.[current.id] || 0)) ? prev : current
                                            ).text}
                                        </div>
                                    </div>
                                ))
                            )}
                            
                            {historyHasMore && (
                                <button className="btn btn-ghost load-more" onClick={loadMoreHistory}>Load More</button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ZenPulseTab;
