import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const validatePassword = (pw) => {
    if (pw.length < 7) return "Password must be at least 7 characters";
    if (pw.length > 18) return "Password must be at most 18 characters";
    if (!/\d/.test(pw)) return "Password must contain at least one number";
    return null;
};

const LoginPage = () => {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuthStore();
    const [form, setForm] = useState({ email: "", password: "" });
    const [pwError, setPwError] = useState("");

    const handleChange = (e) => {
        clearError();
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        if (e.target.name === "password") setPwError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const err = validatePassword(form.password);
        if (err) { setPwError(err); return; }
        const result = await login(form.email, form.password);
        if (result.success) navigate("/");
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

                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">Sign in to your account</p>

                {error && (
                    <div className={`auth-error ${error === "Account Suspended" ? "auth-error-suspended" : ""}`} role="alert">
                        {error === "Account Suspended" ? (
                            <>
                                <strong>Account Suspended</strong>
                                <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                                    Your account has been suspended for violating terms.
                                    Contact admin for further details.
                                </p>
                            </>
                        ) : error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            placeholder="Your password"
                            minLength={7}
                            maxLength={18}
                            value={form.password}
                            onChange={handleChange}
                        />
                        {pwError && <span className="field-hint field-hint-error">{pwError}</span>}
                    </div>

                    <button type="submit" className="btn-primary" disabled={isLoading}>
                        {isLoading ? "Signing in..." : "Sign in"}
                    </button>
                </form>

                <p className="auth-switch">
                    Don't have an account?{" "}
                    <Link to="/register">Create one</Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;