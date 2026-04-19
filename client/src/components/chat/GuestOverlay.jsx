import { Link } from "react-router-dom";

const GuestOverlay = () => {
    return (
        <div className="guest-overlay">
            <div className="guest-card">
                <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-label="ZenChat logo">
                    <rect width="32" height="32" rx="10" fill="#3da5d9" />
                    <path d="M8 10h16M8 16h10M8 22h13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                </svg>

                <h2 className="guest-title">ZenChat</h2>
                <p className="guest-subtitle">Simple, fast messaging for the OLH community</p>

                <div className="guest-actions">
                    <Link to="/login" className="btn-primary guest-btn">
                        Sign in
                    </Link>
                    <Link to="/register" className="btn-outline guest-btn">
                        Create account
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default GuestOverlay;