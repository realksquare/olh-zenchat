import React from "react";

const LoadingOverlay = ({ message = "Loading...", subMessage = "Please wait a moment" }) => {
    return (
        <div className="loading-overlay">
            <div className="loading-content">
                <div className="loading-spinner"></div>
                <div className="loading-text">
                    <h3>{message}</h3>
                    <p>{subMessage}</p>
                </div>
                <div className="loading-progress-container">
                    <div className="loading-progress-bar"></div>
                </div>
            </div>
        </div>
    );
};

export default LoadingOverlay;
