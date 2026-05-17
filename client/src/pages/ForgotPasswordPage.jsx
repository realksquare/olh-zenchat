import { useState } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../utils/axios";

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setSuccessMessage("");

        try {
            const { data } = await axiosInstance.post("/auth/forgot-password", { email });
            setSuccessMessage(data.message || "Reset link successfully sent to your email.");
            setEmail("");
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-brand">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="ZenChat logo">
                        <rect width="32" height="32" rx="10" fill="#3da5d9" />
                        <path d="M8 10h16M8 16h10M8 22h13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                    <span>ZenChat</span>
                </div>

                <h1 className="auth-title">Forgot password</h1>
                <p className="auth-subtitle">Enter your email to receive a password reset link</p>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="auth-error" style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#10b981" }} role="alert">
                        {successMessage}
                    </div>
                )}

                {!successMessage && (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError("");
                                }}
                            />
                        </div>

                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? "Sending..." : "Send reset link"}
                        </button>
                    </form>
                )}

                <p className="auth-switch">
                    Remember your password?{" "}
                    <Link to="/login">Back to login</Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
