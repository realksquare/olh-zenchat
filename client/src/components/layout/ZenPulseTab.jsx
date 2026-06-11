import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { usePulseStore } from "../../stores/pulseStore";
import { getFontFamily } from "../../pages/ZenPulsePage";
import SharePulseModal from "../ui/SharePulseModal";

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

const SnowflakeIcon = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="12" y1="2" x2="12" y2="22"></line>
        <path d="m20 16-4-4 4-4"></path>
        <path d="m4 8 4 4-4 4"></path>
        <path d="m16 4-4 4-4-4"></path>
        <path d="m8 20 4-4 4 4"></path>
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
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPulse, setSelectedPulse] = useState(null);

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
    const isFrozen = !isLoading && !todayQuestion && streak.current > 0;

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
                    <FlameIcon size={18} className={isFrozen ? "ice-flame" : (streak.current > 0 ? "active-flame" : "")} />
                    <span>{streak.current} day streak</span>
                </div>
            </div>

            {isFrozen && (
                <div className="pulse-streak-frozen-info">
                    <SnowflakeIcon size={16} />
                    <span>No Pulse for today, streak saved!</span>
                </div>
            )}

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
                                            style={{ fontFamily: getFontFamily(opt.text) }}
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
                                        <div className="result-label-bar" style={{ fontFamily: getFontFamily(opt.text) }}>
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
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button className="btn btn-outline share-pulse-btn" onClick={() => {
                                        setSelectedPulse(yesterdayQuestion);
                                        setShareModalOpen(true);
                                    }} title="Share Results">
                                        <ShareIcon size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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
                                    <div key={q._id} className="history-item" onClick={() => {
                                        setSelectedPulse(q);
                                        setShareModalOpen(true);
                                    }}>
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

            <SharePulseModal 
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                question={selectedPulse}
                username={user?.username}
            />
        </div>
    );
};

export default ZenPulseTab;
