import { memo } from "react";

const TypingIndicator = ({ scramble }) => {
    return (
        <div className="message-row theirs typing-slide-up">
            <div className="avatar-spacer" />
            <div className="typing-scramble-bubble">
                <span className="scramble-noise">
                    {scramble || "..."}
                </span>
                <div className="scramble-glitch-bar" />
            </div>
        </div>
    );
};

export default memo(TypingIndicator);