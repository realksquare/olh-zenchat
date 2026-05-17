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
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
                            <div style={{ position: "relative" }}>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="Min 7 characters, 1 number"
                                    value={password}
                                    onChange={handleChange}
                                    style={{ width: "100%", paddingRight: "40px" }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: "absolute",
                                        right: "12px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        background: "none",
                                        border: "none",
                                        color: "#64748b",
                                        cursor: "pointer",
                                        padding: 0,
                                        display: "flex",
                                        alignItems: "center"
                                    }}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    required
                                    placeholder="Repeat new password"
                                    value={confirmPassword}
                                    onChange={handleChange}
                                    style={{ width: "100%", paddingRight: "40px" }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={{
                                        position: "absolute",
                                        right: "12px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        background: "none",
                                        border: "none",
                                        color: "#64748b",
                                        cursor: "pointer",
                                        padding: 0,
                                        display: "flex",
                                        alignItems: "center"
                                    }}
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                >
                                    {showConfirmPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            </div>
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
