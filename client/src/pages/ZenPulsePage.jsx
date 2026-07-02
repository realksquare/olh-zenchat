import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import html2canvas from "html2canvas";
import { useAuthStore } from "../stores/authStore";
import { usePulseStore } from "../stores/pulseStore";

export const getFontFamily = (text) => {
    if (!text) return undefined;
    const t = text.toLowerCase();
    if (t.includes('outfit')) return "'Outfit', sans-serif";
    if (t.includes('dm sans')) return "'DM Sans', sans-serif";
    if (t.includes('space grotesk')) return "'Space Grotesk', sans-serif";
    if (t.includes('plus jakarta')) return "'Plus Jakarta Sans', sans-serif";
    if (t.includes('inter')) return "'Inter', sans-serif";
    return undefined;
};

const isOlderThanYesterday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return date < yesterday;
};

const ZenPulsePage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = useAuthStore((s) => s.token);
    
    const { todayQuestion, yesterdayQuestion, fetchToday, fetchYesterday, submitGuestVote, isLoading } = usePulseStore();
    
    const [selectedOption, setSelectedOption] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [voteError, setVoteError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isSharingToday, setIsSharingToday] = useState(false);
    const [isSharingYesterday, setIsSharingYesterday] = useState(false);
    const todayCardRef = useRef(null);
    const yesterdayCardRef = useRef(null);

    const handleShare = async (type) => {
        const isToday = type === 'today';
        const cardRef = isToday ? todayCardRef : yesterdayCardRef;
        if (!cardRef.current) return;

        if (isToday) setIsSharingToday(true);
        else setIsSharingYesterday(true);

        try {
            await new Promise(r => setTimeout(r, 100)); // allow state to hide button

            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: "#0f172a",
                scale: 2,
            });

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Canvas to Blob failed");
                const file = new File([blob], `zenpulse-${type}.png`, { type: "image/png" });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'ZenPulse',
                            text: 'Check out this pulse on ZenChat!'
                        });
                    } catch (e) {
                        console.log("Share cancelled or failed", e);
                    }
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `zenpulse-${type}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            }, "image/png");
        } catch (error) {
            console.error("Error generating image:", error);
        } finally {
            if (isToday) setIsSharingToday(false);
            else setIsSharingYesterday(false);
        }
    };

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
                if (parsed.optionId) setSelectedOption(parsed.optionId);
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
            localStorage.setItem("zenpulse_guest_voted_today", JSON.stringify({ date: todayStr, optionId: selectedOption }));
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
                    <p style={{ margin: 0, marginTop: '4px', fontSize: '0.8rem', color: '#94a3b8' }}>Daily community opinion by OLH ZenChat</p>
                </div>
                <Link to="/register" className="btn btn-primary join-btn">Join ZenChat</Link>
            </header>

            <main className="zenpulse-main">
                <div className="pulse-card active-pulse" ref={todayCardRef} style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div className="pulse-badge" style={{ marginBottom: 0 }}>Today's Pulse</div>
                        {!isSharingToday && todayQuestion && (
                            <button className="share-pulse-btn" onClick={() => handleShare('today')} title="Share / Download">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                            </button>
                        )}
                    </div>
                    
                    
                    {isLoading ? (
                        <div className="pulse-loading">Loading...</div>
                    ) : todayQuestion ? (
                        <>
                            <h1 className="pulse-question">{todayQuestion.question}</h1>
                            
                            <div className="pulse-options">
                                {todayQuestion.options.map(opt => (
                                    <button 
                                        key={opt.id}
                                        className={`pulse-option-btn ${selectedOption === opt.id ? 'selected' : ''}`}
                                        onClick={() => !hasVoted && setSelectedOption(opt.id)}
                                        style={{ fontFamily: getFontFamily(opt.text), opacity: hasVoted ? 0.7 : 1, cursor: hasVoted ? 'default' : 'pointer' }}
                                        disabled={hasVoted}
                                    >
                                        {opt.text}
                                    </button>
                                ))}
                                
                                {voteError && <p className="pulse-error">{voteError}</p>}
                                
                                {!hasVoted ? (
                                    <button 
                                        className="btn btn-primary submit-vote-btn"
                                        disabled={!selectedOption || isSubmitting}
                                        onClick={handleVote}
                                    >
                                        {isSubmitting ? "Submitting..." : "Submit Vote"}
                                    </button>
                                ) : (
                                    <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem', color: '#94a3b8' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px', color: '#10b981' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                            <span style={{ fontWeight: 600 }}>Vote cast successfully</span>
                                        </div>
                                        Results will be revealed tomorrow at 7 PM IST.
                                        
                                        <div className="join-cta-box" style={{ marginTop: '16px' }}>
                                            <p style={{ marginBottom: '12px' }}>Want to see every day's results and chat privately?</p>
                                            {!isSharingToday && (
                                                <Link to={`/register${searchParams.get('ref') ? `?ref=${searchParams.get('ref')}` : ''}`} className="btn btn-primary">
                                                    Join ZenChat - It's Free
                                                </Link>
                                            )}
                                        </div>
                                        {isSharingToday && (
                                            <div className="pulse-watermark" style={{ textAlign: 'center', fontSize: '0.85rem', color: '#334155', marginTop: '16px', fontWeight: 'bold' }}>OLH ZenChat</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="no-pulse">
                            <h3>No active question right now</h3>
                            <p>Check back later for the next pulse!</p>
                        </div>
                    )}
                </div>

                {yesterdayQuestion && (
                    <div className="pulse-card yesterday-pulse" ref={yesterdayCardRef}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div className="pulse-badge secondary">
                                {isOlderThanYesterday(yesterdayQuestion.revealedAt || yesterdayQuestion.createdAt) ? "Previous ZenPulse" : "Yesterday's Results"}
                            </div>
                            {!isSharingYesterday && (
                                <button className="share-pulse-btn" onClick={() => handleShare('yesterday')} title="Share / Download">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                </button>
                            )}
                        </div>
                        <h3 className="pulse-question-small">{yesterdayQuestion.question}</h3>
                        
                        <div className="pulse-results">
                            {yesterdayQuestion.options.map(opt => {
                                const count = yesterdayQuestion.optionCounts?.[opt.id] || 0;
                                const total = yesterdayQuestion.totalVotes || 1;
                                const percentage = Math.round((count / total) * 100);
                                
                                return (
                                    <div key={opt.id} className="pulse-result-row">
                                        <div className="pulse-result-label" style={{ fontFamily: getFontFamily(opt.text) }}>
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
                            <div className="pulse-watermark" style={{ textAlign: 'center', fontSize: '0.85rem', color: '#334155', marginTop: '16px', fontWeight: 'bold' }}>OLH ZenChat</div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ZenPulsePage;
