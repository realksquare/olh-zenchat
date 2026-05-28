import { useState, useEffect, useRef } from "react";
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
    const {
        login,
        verify2faOtp,
        triggerChallenge,
        resetMfaState,
        mfaRequired,
        mfaType,
        mfaUserId,
        mfaMaskedValue,
        isLoading,
        error,
        clearError
    } = useAuthStore();

    const [form, setForm] = useState({ email: "", password: "" });
    const [pwError, setPwError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [otpCode, setOtpCode] = useState("");
    const [showRecoveryBypass, setShowRecoveryBypass] = useState(false);
    const [recoveryKey, setRecoveryKey] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const otpInputRef = useRef(null);
    const recoveryInputRef = useRef(null);

    useEffect(() => {
        resetMfaState();
        clearError();
    }, [resetMfaState, clearError]);

    useEffect(() => {
        if (mfaRequired && otpInputRef.current) {
            otpInputRef.current.focus();
        }
    }, [mfaRequired]);

    useEffect(() => {
        if (showRecoveryBypass && recoveryInputRef.current) {
            recoveryInputRef.current.focus();
        }
    }, [showRecoveryBypass]);

    const handleChange = (e) => {
        clearError();
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        if (e.target.name === "password") setPwError("");
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        const err = validatePassword(form.password);
        if (err) { setPwError(err); return; }

        const result = await login(form.email, form.password);
        if (result.success) {
            if (!result.mfaRequired) {
                navigate("/");
            } else {
                setSuccessMessage("Credentials verified! Please complete 2FA.");
            }
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        await handleVerifyOtpDirect(otpCode);
    };

    const handleVerifyOtpDirect = async (codeToVerify) => {
        if (!codeToVerify || codeToVerify.length < 6) return;

        const result = await verify2faOtp(mfaUserId, codeToVerify);
        if (result.success) {
            navigate("/");
        }
    };

    const handleRecoveryBypassSubmit = async (e) => {
        e.preventDefault();
        if (!recoveryKey.trim()) return;

        const result = await triggerChallenge(mfaUserId, recoveryKey.trim());
        if (result.success) {
            navigate("/");
        }
    };

    const handleBackToLogin = () => {
        setShowRecoveryBypass(false);
        resetMfaState();
        clearError();
        setSuccessMessage("");
    };

    if (mfaRequired) {
        return (
            <div className="auth-page">
                <div className="auth-card" style={{ maxWidth: "440px", border: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(20px)" }}>
                    <div className="auth-brand" style={{ justifyContent: "center" }}>
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <rect width="32" height="32" rx="10" fill="#3da5d9" />
                            <path d="M8 10h16M8 16h10M8 22h13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                        <span>ZenChat</span>
                    </div>

                    {!showRecoveryBypass ? (
                        <>
                            <h1 className="auth-title" style={{ fontSize: "1.6rem", textAlign: "center" }}>Enter Code</h1>
                            <p className="auth-subtitle" style={{ textAlign: "center", marginBottom: "24px" }}>
                                We sent a 6-digit code to <strong style={{ color: "var(--color-primary)" }}>{mfaMaskedValue}</strong> via Email.
                            </p>

                            {successMessage && (
                                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "#10b981", padding: "10px 14px", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "16px", textAlign: "center" }}>
                                    {successMessage}
                                </div>
                            )}

                            {error && <div className="auth-error" style={{ textAlign: "center" }}>{error}</div>}

                            <form onSubmit={handleVerifyOtp} className="auth-form">
                                <div className="field">
                                    <input
                                        ref={otpInputRef}
                                        id="otpCode"
                                        name="otpCode"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        autoComplete="one-time-code"
                                        required
                                        maxLength={6}
                                        placeholder="0 0 0 0 0 0"
                                        value={otpCode}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "");
                                            setOtpCode(val);
                                            if (val.length === 6) {
                                                handleVerifyOtpDirect(val);
                                            }
                                        }}
                                        style={{
                                            textAlign: "center",
                                            fontSize: "1.8rem",
                                            letterSpacing: "8px",
                                            padding: "12px",
                                            fontFamily: "monospace",
                                            background: "rgba(30, 41, 59, 0.6)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            color: "#fff"
                                        }}
                                    />
                                </div>

                                <button type="submit" className="btn-primary" disabled={isLoading || otpCode.length < 6}>
                                    {isLoading ? "Verifying..." : "Verify Code"}
                                </button>
                            </form>

                            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowRecoveryBypass(true)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        background: "rgba(99, 102, 241, 0.1)",
                                        border: "1px solid rgba(99, 102, 241, 0.2)",
                                        color: "#a5b4fc",
                                        transition: "all 0.2s"
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(99, 102, 241, 0.2)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)";
                                    }}
                                >
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m-9 5a3 3 0 11-6 0 3 3 0 016 0zm6.342 1.658L16 20m0 0l-2.343-2.343m2.343 2.343l2.343-2.343M16 12H8" />
                                    </svg>
                                    Use E2EE Offline Recovery Key
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={handleBackToLogin}
                                style={{
                                    marginTop: "16px",
                                    background: "none",
                                    border: "none",
                                    color: "#94a3b8",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    fontSize: "0.85rem",
                                    width: "100%",
                                    textAlign: "center"
                                }}
                            >
                                Back to Sign In
                            </button>
                        </>
                    ) : (
                        <>
                            <h1 className="auth-title" style={{ fontSize: "1.5rem", textAlign: "center" }}>Offline Recovery Key</h1>
                            <p className="auth-subtitle" style={{ textAlign: "center", marginBottom: "20px" }}>
                                Enter your 16-character E2EE offline recovery key to mathematically prove ownership and bypass 2FA.
                            </p>

                            {error && <div className="auth-error" style={{ textAlign: "center" }}>{error}</div>}

                            <form onSubmit={handleRecoveryBypassSubmit} className="auth-form">
                                <div className="field">
                                    <label htmlFor="recoveryKey">Offline Recovery Key</label>
                                    <input
                                        ref={recoveryInputRef}
                                        id="recoveryKey"
                                        name="recoveryKey"
                                        type="text"
                                        required
                                        placeholder="ZNC-XXXX-XXXX-XXXX"
                                        value={recoveryKey}
                                        onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                                        style={{
                                            textAlign: "center",
                                            letterSpacing: "1px",
                                            fontFamily: "monospace",
                                            fontSize: "1.1rem",
                                            background: "rgba(30, 41, 59, 0.6)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            color: "#fff"
                                        }}
                                    />
                                </div>

                                <button type="submit" className="btn-primary" disabled={isLoading || recoveryKey.length < 10}>
                                    {isLoading ? "Validating Cryptography..." : "Verify & Complete Login"}
                                </button>
                            </form>

                            <button
                                type="button"
                                onClick={() => setShowRecoveryBypass(false)}
                                style={{
                                    marginTop: "16px",
                                    background: "none",
                                    border: "none",
                                    color: "#94a3b8",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    fontSize: "0.85rem",
                                    width: "100%",
                                    textAlign: "center"
                                }}
                            >
                                Back to OTP Screen
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

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

                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">Sign in to your account</p>

                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", padding: "12px", marginBottom: "20px", textAlign: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "#a7f3d0", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        New: 21-day auto-cleanup active!
                    </span>
                    <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginTop: "4px" }}>Keeping your digital footprint light & meaningful.</p>
                </div>

                {error && (
                    <div className={`auth-error ${error === "Account Suspended" ? "auth-error-suspended" : ""}`} role="alert">
                        {error === "Account Suspended" ? (
                            <>
                                <strong>Account Suspended</strong>
                                <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                                    Your account has been suspended.
                                    Contact admin for further details.
                                </p>
                            </>
                        ) : error}
                    </div>
                )}

                <form onSubmit={handleEmailSubmit} className="auth-form">
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <label htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                            <Link to="/forgot-password" style={{ fontSize: "0.8rem", color: "var(--color-primary)", textDecoration: "none" }}>Forgot password?</Link>
                        </div>
                        <div style={{ position: "relative" }}>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                placeholder="Your password"
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
                        {pwError && <span className="field-hint field-hint-error">{pwError}</span>}
                    </div>

                    <button type="submit" className="btn-primary" disabled={isLoading}>
                        {isLoading ? "Signing in..." : "Sign in"}
                    </button>
                </form>

                <p className="auth-switch">
                    Don't have an account?{" "}
                    <Link to="/register">Create one!</Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;