import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const validatePassword = (pw) => {
    if (pw.length < 7) return "At least 7 characters";
    if (pw.length > 18) return "At most 18 characters";
    if (!/\d/.test(pw)) return "Must contain at least one number";
    return null;
};

const RegisterPage = () => {
    const navigate = useNavigate();
    const {
        register,
        resetMfaState,
        isLoading,
        error,
        clearError
    } = useAuthStore();

    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [pwError, setPwError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        resetMfaState();
        clearError();
    }, [resetMfaState, clearError]);

    const handleChange = (e) => {
        clearError();
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        if (e.target.name === "password") setPwError("");
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        const err = validatePassword(form.password);
        if (err) { setPwError(err); return; }

        const searchParams = new URLSearchParams(window.location.search);
        const refParam = searchParams.get("ref");

        const result = await register(form.username, form.email, form.password, refParam);
        if (result.success) {
            sessionStorage.setItem("showFAQOnLoad", "1");
            navigate("/");
        }
    };

    const pwHint = validatePassword(form.password);

    return (
        <div className="auth-page">
            <div className="auth-card" style={{ border: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(20px)" }}>
                <div className="auth-brand">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="ZenChat logo">
                        <rect width="32" height="32" rx="10" fill="#3da5d9" />
                        <path d="M8 10h16M8 16h10M8 22h13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                    <span>ZenChat</span>
                </div>

                <h1 className="auth-title">Create account</h1>
                <p className="auth-subtitle">Experience fast, safe, no-nonsense, and forever free messaging!</p>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleEmailSubmit} className="auth-form">
                    <div className="field">
                        <label htmlFor="username">Choose a username</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            placeholder="Choose a unique username - 3-20 characters"
                            minLength={3}
                            maxLength={20}
                            value={form.username}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="Email Address"
                            value={form.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <div style={{ position: "relative" }}>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                required
                                placeholder="7-18 chars, one number"
                                minLength={7}
                                maxLength={18}
                                value={form.password}
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
                        {form.password && (
                            <span className={`field-hint ${pwHint ? "field-hint-error" : "field-hint-ok"}`}>
                                {pwHint || "Password fits criteria."}
                            </span>
                        )}
                        {pwError && !form.password && (
                            <span className="field-hint field-hint-error">{pwError}</span>
                        )}
                    </div>

                    <button type="submit" className="btn-primary" disabled={isLoading}>
                        {isLoading ? "Creating account..." : "Create account"}
                    </button>
                </form>

                <p className="auth-switch">
                    Already have an account?{" "}
                    <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;