import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axios";

const ResetPasswordPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [form, setForm] = useState({ password: "", confirmPassword: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const password = form.password;
    const confirmPassword = form.confirmPassword;

    // Password criteria calculations
    const meetsLength = password.length >= 7 && password.length <= 18;
    const meetsNumber = /\d/.test(password);
    const matchesConfirm = password && password === confirmPassword;

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!meetsLength || !meetsNumber) {
            setError("Password does not meet the required security standard.");
            return;
        }

        if (!matchesConfirm) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const { data } = await axiosInstance.post(`/auth/reset-password/${token}`, {
                newPassword: password,
            });
            setSuccessMessage(data.message || "Password successfully reset.");
            setTimeout(() => {
                navigate("/login");
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Password reset token is invalid or has expired.");
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

                <h1 className="auth-title">Reset password</h1>
                <p className="auth-subtitle">Set your new secure password</p>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="auth-error" style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#10b981" }} role="alert">
                        {successMessage}
                        <div style={{ fontSize: "0.8rem", marginTop: "6px", color: "rgba(16, 185, 129, 0.85)" }}>
                            Redirecting to login page...
                        </div>
                    </div>
                )}

                {!successMessage && (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="field">
                            <label htmlFor="password">New Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                placeholder="Min 7 characters, 1 number"
                                value={password}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                placeholder="Repeat new password"
                                value={confirmPassword}
                                onChange={handleChange}
                            />
                        </div>

                        {/* Visual Security Checklist */}
                        <div className="password-checklist" style={{ margin: "16px 0", background: "rgba(255, 255, 255, 0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-muted)", marginBottom: "8px" }}>PASSWORD REQUIREMENTS</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: meetsLength ? "#10b981" : "var(--color-text-muted)" }}>
                                    <span style={{ fontSize: "1rem" }}>{meetsLength ? "✓" : "○"}</span>
                                    <span>Between 7 and 18 characters</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: meetsNumber ? "#10b981" : "var(--color-text-muted)" }}>
                                    <span style={{ fontSize: "1rem" }}>{meetsNumber ? "✓" : "○"}</span>
                                    <span>At least one number (0-9)</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: matchesConfirm ? "#10b981" : "var(--color-text-muted)" }}>
                                    <span style={{ fontSize: "1rem" }}>{matchesConfirm ? "✓" : "○"}</span>
                                    <span>Passwords match</span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isLoading || !meetsLength || !meetsNumber || !matchesConfirm}
                        >
                            {isLoading ? "Saving password..." : "Save password"}
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

export default ResetPasswordPage;
