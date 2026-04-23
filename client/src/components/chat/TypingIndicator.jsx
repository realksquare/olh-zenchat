const TypingIndicator = () => {
    return (
        <div className="message-row theirs">
            <div className="avatar-spacer" />
            <div className="typing-wave">
                <span className="wave-bar" style={{ animationDelay: "0ms" }} />
                <span className="wave-bar" style={{ animationDelay: "80ms" }} />
                <span className="wave-bar" style={{ animationDelay: "160ms" }} />
                <span className="wave-bar" style={{ animationDelay: "240ms" }} />
                <span className="wave-bar" style={{ animationDelay: "320ms" }} />
            </div>
        </div>
    );
};

export default TypingIndicator;