import { memo } from "react";

const TypingIndicator = ({ scramble }) => {
    return (
        <div className="message-row theirs typing-slide-up">
            <div className="avatar-spacer" />
            {scramble ? (
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