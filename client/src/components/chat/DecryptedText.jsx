import { useState, useEffect, memo } from "react";

const DecryptedText = ({ text, animate = false }) => {
    const [displayText, setDisplayText] = useState(animate ? "" : text);
    const [isAnimating, setIsAnimating] = useState(animate);

    useEffect(() => {
        if (!animate) {
            setDisplayText(text);
            return;
        }

        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789░▒▓█";
        const leetMap = { 'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7' };
        
        let iteration = 0;
        const maxIterations = 12;
        const intervalTime = 60;

        const interval = setInterval(() => {
            const result = text.split("").map((char, index) => {
                // Reveal logic: reveal progressively from left to right
                const revealThreshold = (iteration / maxIterations) * text.length;
                
                if (index < revealThreshold) {
                    return text[index];
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

    return <span className={isAnimating ? "decryption-pulse" : ""}>{displayText}</span>;
};

export default memo(DecryptedText);
