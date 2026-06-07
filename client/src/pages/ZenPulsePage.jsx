import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { usePulseStore } from "../stores/pulseStore";

const ZenPulsePage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = useAuthStore((s) => s.token);
    
    const { todayQuestion, yesterdayQuestion, fetchToday, fetchYesterday, submitGuestVote, isLoading } = usePulseStore();
    
    const [selectedOption, setSelectedOption] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [voteError, setVoteError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (token) {
            navigate("/?tab=pulse", { replace: true });
        }
    }, [token, navigate]);

    useEffect(() => {
        fetchToday();
        fetchYesterday();
        
        // Check local storage if they already voted as guest today
        const guestVoted = localStorage.getItem("zenpulse_guest_voted_today");
        if (guestVoted) {
            const parsed = JSON.parse(guestVoted);
            // Simple check if it's the same day (UTC)
            const todayStr = new Date().toISOString().split("T")[0];
            if (parsed.date === todayStr) {
                setHasVoted(true);
            }
        }
    }, [fetchToday, fetchYesterday]);

    const handleVote = async () => {
        if (!selectedOption || !todayQuestion) return;
        setIsSubmitting(true);
        setVoteError("");

        const ref = searchParams.get("ref");
        const res = await submitGuestVote(todayQuestion._id, selectedOption, ref);
        
        setIsSubmitting(false);

        if (res.success) {
            setHasVoted(true);
            const todayStr = new Date().toISOString().split("T")[0];
            localStorage.setItem("zenpulse_guest_voted_today", JSON.stringify({ date: todayStr }));
        } else {
            setVoteError(res.message);
        }
    };

    if (token) return null; // Prevent flash before redirect

    return (
        <div className="zenpulse-public-page">
            <header className="zenpulse-header">
                <div className="logo-container">
                    <h2>ZenPulse</h2>
                </div>
                <Link to="/register" className="btn btn-primary join-btn">Join ZenChat</Link>
            </header>

            <main className="zenpulse-main">
                <div className="pulse-card active-pulse">
                    <div className="pulse-badge">Today's Pulse</div>
                    
                    {isLoading ? (
                        <div className="pulse-loading">Loading...</div>
                    ) : todayQuestion ? (
                        <>
                            <h1 className="pulse-question">{todayQuestion.question}</h1>
                            
                            {!hasVoted ? (
                                <div className="pulse-options">
                                    {todayQuestion.options.map(opt => (
                                        <button 
                                            key={opt.id}
                                            className={`pulse-option-btn ${selectedOption === opt.id ? 'selected' : ''}`}
                                            onClick={() => setSelectedOption(opt.id)}
                                        >
                                            {opt.text}
                                        </button>
                                    ))}
                                    
                                    {voteError && <p className="pulse-error">{voteError}</p>}
                                    
                                    <button 
                                        className="btn btn-primary submit-vote-btn"
                                        disabled={!selectedOption || isSubmitting}
                                        onClick={handleVote}
                                    >
                                        {isSubmitting ? "Submitting..." : "Submit Vote"}
                                    </button>
                                </div>
                            ) : (
                                <div className="pulse-success-state">
                                    <div className="success-icon">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                    <h3>Your vote is in!</h3>
                                    <p>The community results will be revealed tomorrow at 7 PM IST.</p>
                                    <div className="join-cta-box">
                                        <p>Want to see every day's results and chat privately?</p>
                                        <Link to={`/register${searchParams.get('ref') ? `?ref=${searchParams.get('ref')}` : ''}`} className="btn btn-primary">
                                            Join ZenChat - It's Free
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="no-pulse">
                            <h3>No active question right now</h3>
                            <p>Check back later for the next pulse!</p>
                        </div>
                    )}
                </div>

                {yesterdayQuestion && (
                    <div className="pulse-card yesterday-pulse">
                        <div className="pulse-badge secondary">Yesterday's Results</div>
                        <h3 className="pulse-question-small">{yesterdayQuestion.question}</h3>
                        
                        <div className="pulse-results">
                            {yesterdayQuestion.options.map(opt => {
                                const count = yesterdayQuestion.optionCounts?.[opt.id] || 0;
                                const total = yesterdayQuestion.totalVotes || 1;
                                const percentage = Math.round((count / total) * 100);
                                
                                return (
                                    <div key={opt.id} className="pulse-result-row">
                                        <div className="pulse-result-label">
                                            <span>{opt.text}</span>
                                            <span>{percentage}%</span>
                                        </div>
                                        <div className="pulse-result-bar-bg">
                                            <div className="pulse-result-bar-fill" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                            <p className="pulse-total-votes">{yesterdayQuestion.totalVotes} total votes</p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ZenPulsePage;
