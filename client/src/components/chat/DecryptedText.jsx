import { useState, useEffect, memo } from "react";

const DecryptedText = ({ text, animate = false }) => {
    const [displayText, setDisplayText] = useState(animate ? "" : text);
    const [isAnimating, setIsAnimating] = useState(animate);

    useEffect(() => {
        if (!animate) {
            setDisplayText(text);
            return;
        }

        const chars = "01<>/_░▒▓█";
        const leetMap = { 'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7' };
        
        let iteration = 0;
        const maxIterations = 12;
        const intervalTime = 60;

        const interval = setInterval(() => {
            const safeText = text || "";
            const result = safeText.split("").map((char, index) => {
                // Reveal logic: reveal progressively from left to right
                const revealThreshold = (iteration / maxIterations) * safeText.length;
                
                if (index < revealThreshold) {
                    return safeText[index];
                }
                
                const lowerChar = char.toLowerCase();
                if (leetMap[lowerChar] && Math.random() > 0.4) {
                    return leetMap[lowerChar];
                }

                return chars.charAt(Math.floor(Math.random() * chars.length));
            }).join("");

            setDisplayText(result);

            if (iteration >= maxIterations) {
                clearInterval(interval);
                setDisplayText(text);
                setIsAnimating(false);
            }
            iteration++;
        }, intervalTime);

        return () => clearInterval(interval);
    }, [text, animate]);

    if (isAnimating) {
        return <span className="decryption-pulse">{displayText}</span>;
    }

    if (!text) return null;

    const urlRegex = /((?:https?:\/\/|www\.)[^\s<>"'`]+)/gi;
    const parts = text.split(urlRegex);

    return (
        <span>
            {parts.map((part, index) => {
                const isUrl = /^(?:https?:\/\/|www\.)/i.test(part);
                if (isUrl) {
                    // Strip trailing punctuation commonly typed at the end of URLs
                    let cleanUrl = part;
                    let trailing = "";
                    const trailingPunctuationRegex = /[.,\/#!$%\^&\*;:{}=\-_`~()?!\s]+$/;
                    const match = part.match(trailingPunctuationRegex);
                    if (match) {
                        cleanUrl = part.slice(0, match.index);
                        trailing = part.slice(match.index);
                    }

                    const href = cleanUrl.toLowerCase().startsWith("www.") ? `https://${cleanUrl}` : cleanUrl;

                    return (
                        <span key={index}>
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="chat-link"
                                style={{
                                    color: "var(--color-primary)",
                                    textDecoration: "underline",
                                    fontWeight: "500",
                                    wordBreak: "break-all",
                                    transition: "opacity 0.2s",
                                }}
                                onMouseEnter={(e) => e.target.style.opacity = 0.8}
                                onMouseLeave={(e) => e.target.style.opacity = 1}
                            >
                                {cleanUrl}
                            </a>
                            {trailing}
                        </span>
                    );
                }
                return part;
            })}
        </span>
    );
};

export default memo(DecryptedText);
