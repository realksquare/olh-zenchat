import { useState } from "react";
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
    const { register, isLoading, error, clearError } = useAuthStore();
    const [form, setForm] = useState({ username: "", email: "", password: "" });
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
        const result = await register(form.username, form.email, form.password);
        if (result.success) navigate("/");
    };

    const pwHint = validatePassword(form.password);

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

                <h1 className="auth-title">Create account</h1>
                <p className="auth-subtitle">Join the OLH community</p>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="field">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            placeholder="yourname"
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
                            autoComplete="new-password"
                            required
                            placeholder="7-18 chars, one number"
                            minLength={7}
                            maxLength={18}
                            value={form.password}
                            onChange={handleChange}
                        />
                        {form.password && (
                            <span className={`field-hint ${pwHint ? "field-hint-error" : "field-hint-ok"}`}>
                                {pwHint || "Password looks good"}
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