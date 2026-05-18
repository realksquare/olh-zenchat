import { memo } from "react";

const TypingIndicator = ({ scramble }) => {
    const showScramble = scramble && typeof scramble === "string";
    return (
        <div className="message-row theirs typing-slide-up">
            <div className="avatar-spacer" />
            {showScramble ? (
                <div className="typing-scramble-bubble">
                    <span className="scramble-noise">
                        {scramble}
                    </span>
                    <div className="scramble-glitch-bar" />
                </div>
            ) : (
                <div className="typing-wave">
                    <span className="wave-bar" style={{ animationDelay: "0ms" }} />
                    <span className="wave-bar" style={{ animationDelay: "100ms" }} />
                    <span className="wave-bar" style={{ animationDelay: "200ms" }} />
                </div>
            )}
        </div>
    );
};

export default memo(TypingIndicator);