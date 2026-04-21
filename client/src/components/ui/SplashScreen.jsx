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
                    <img src="/logo512.png" alt="ZenChat Logo" />
                    <div className="splash-glow"></div>
                </div>
                <h1 className="splash-title">OLH ZenChat</h1>
                <div className="splash-status">
                    <div className="splash-loader">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <p>Waking up the servers...</p>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
