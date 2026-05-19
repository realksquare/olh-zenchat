import { useState, useEffect } from "react";

const SplashScreen = ({ isReady }) => {
    const [shouldRender, setShouldRender] = useState(true);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        if (isReady) {
            setIsFading(true);
            const timer = setTimeout(() => setShouldRender(false), 500);
            return () => clearTimeout(timer);
        }
    }, [isReady]);

    if (!shouldRender) return null;

    return (
        <div className={`splash-screen ${isFading ? "fade-out" : ""}`}>
            <div className="splash-content">
                <div className="splash-logo">
                    {/* Inline SVG logo - zero network requests, instant render */}
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="80" height="80" rx="22" fill="#1e2530" />
                        <line x1="20" y1="27" x2="60" y2="27" stroke="#3da5d9" strokeWidth="5.5" strokeLinecap="round" />
                        <line x1="20" y1="40" x2="50" y2="40" stroke="#3da5d9" strokeWidth="5.5" strokeLinecap="round" />
                        <line x1="20" y1="53" x2="52" y2="53" stroke="#3da5d9" strokeWidth="5.5" strokeLinecap="round" />
                    </svg>
                    <div className="splash-glow"></div>
                </div>
                <h1 className="splash-title">ZenChat</h1>
                <div className="splash-status">
                    <div className="splash-loader">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <p>Powered by your internet browser...</p>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
