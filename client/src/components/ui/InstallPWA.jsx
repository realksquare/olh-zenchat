import { useState, useEffect } from "react";

const InstallPWA = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            // Prevent Chrome from showing the mini-infobar
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI to show the install button
            setIsVisible(true);
        };

        window.addEventListener("beforeinstallprompt", handler);

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        // Optionally, do something with the outcome
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
        
        setDeferredPrompt(null);
    };

    if (!isVisible) return null;

    return (
        <button 
            onClick={handleInstall}
            className="btn"
            style={{ 
                background: '#3da5d9', 
                color: 'white', 
                fontSize: '12px', 
                padding: '4px 12px', 
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Install App
        </button>
    );
};

export default InstallPWA;
