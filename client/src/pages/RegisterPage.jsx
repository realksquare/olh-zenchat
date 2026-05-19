import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import axiosInstance from "../utils/axios";

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
        registerPhone, 
        verifyOtp, 
        resetMfaState, 
        isLoading, 
        error, 
        clearError 
    } = useAuthStore();

    // Tab state: 'email' or 'phone'
    const [activeTab, setActiveTab] = useState("email");
    const [form, setForm] = useState({ username: "", email: "", password: "", phoneNumber: "" });
    const [pwError, setPwError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // OTP states
    const [otpSent, setOtpSent] = useState(false);
    const [tempUserId, setTempUserId] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const otpInputRef = useRef(null);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const refParam = searchParams.get("ref");
        if (refParam) {
            axiosInstance.post(`/auth/referral/click/${refParam}`).catch(() => {});
        }
        resetMfaState();
        clearError();
    }, [resetMfaState, clearError]);

    // Focus OTP input when OTP screen is shown
    useEffect(() => {
        if (otpSent && otpInputRef.current) {
            otpInputRef.current.focus();
        }
    }, [otpSent]);

    // WebOTP auto-fill integration for seamless mobile access
    useEffect(() => {
        if ('OTPCredential' in window && otpSent) {
            const ac = new AbortController();
            navigator.credentials.get({
                otp: { transport: ['sms'] },
                signal: ac.signal
            }).then(otp => {
                if (otp && otp.code) {
                    setOtpCode(otp.code);
                    handleVerifyOtpDirect(otp.code);
                }
            }).catch(err => {
                console.log("WebOTP registration code fetch skipped:", err);
            });
            return () => ac.abort();
        }
    }, [otpSent]);

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

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        if (!form.username.trim() || !form.phoneNumber.trim()) return;
        
        const result = await registerPhone(form.username, form.phoneNumber);
        if (result.success) {
            setTempUserId(result.userId);
            setOtpSent(true);
            setSuccessMessage(`Verification code sent to ${form.phoneNumber}`);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        await handleVerifyOtpDirect(otpCode);
    };

    const handleVerifyOtpDirect = async (codeToVerify) => {
        if (!codeToVerify || codeToVerify.length < 6) return;
        
        const result = await verifyOtp(tempUserId, codeToVerify);
        if (result.success) {
            sessionStorage.setItem("showFAQOnLoad", "1");
            navigate("/");
        }
    };

    const pwHint = validatePassword(form.password);

    if (otpSent) {
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

                    <h1 className="auth-title" style={{ fontSize: "1.6rem", textAlign: "center" }}>Verify Your Phone</h1>
                    <p className="auth-subtitle" style={{ textAlign: "center", marginBottom: "24px" }}>
                        We sent a 6-digit code to <strong style={{ color: "var(--color-primary)" }}>{form.phoneNumber}</strong>.
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

                    <button
                        type="button"
                        onClick={() => setOtpSent(false)}
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
                        Back to Register
                    </button>
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

                <h1 className="auth-title">Create account</h1>
                <p className="auth-subtitle">Join the OLH community</p>

                {/* Premium Tab Bar with HSL tailored design */}
                <div style={{
                    display: "flex",
                    background: "rgba(30, 41, 59, 0.5)",
                    padding: "4px",
                    borderRadius: "10px",
                    marginBottom: "24px",
                    border: "1px solid rgba(255,255,255,0.05)"
                }}>
                    <button
                        type="button"
                        onClick={() => { setActiveTab("email"); clearError(); }}
                        style={{
                            flex: 1,
                            padding: "10px",
                            borderRadius: "8px",
                            border: "none",
                            background: activeTab === "email" ? "rgba(61, 165, 217, 0.15)" : "none",
                            color: activeTab === "email" ? "#3da5d9" : "#94a3b8",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        Email Signup
                    </button>
                    <button
                        type="button"
                        onClick={() => { setActiveTab("phone"); clearError(); }}
                        style={{
                            flex: 1,
                            padding: "10px",
                            borderRadius: "8px",
                            border: "none",
                            background: activeTab === "phone" ? "rgba(61, 165, 217, 0.15)" : "none",
                            color: activeTab === "phone" ? "#3da5d9" : "#94a3b8",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        Phone OTP Signup
                    </button>
                </div>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                {activeTab === "email" ? (
                    <form onSubmit={handleEmailSubmit} className="auth-form">
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
                ) : (
                    <form onSubmit={handlePhoneSubmit} className="auth-form">
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
                            <label htmlFor="phoneNumber">Phone Number</label>
                            <input
                                id="phoneNumber"
                                name="phoneNumber"
                                type="tel"
                                autoComplete="tel"
                                required
                                placeholder="+1 234 567 8900"
                                value={form.phoneNumber}
                                onChange={handleChange}
                                style={{
                                    fontSize: "1.05rem",
                                    letterSpacing: "0.5px"
                                }}
                            />
                            <span className="field-hint" style={{ color: "#64748b" }}>
                                Enter phone number with country code (e.g. +1, +91)
                            </span>
                        </div>

                        <button type="submit" className="btn-primary" disabled={isLoading || !form.username.trim() || !form.phoneNumber.trim()}>
                            {isLoading ? "Sending OTP..." : "Request Verification Code"}
                        </button>
                    </form>
                )}

                <p className="auth-switch">
                    Already have an account?{" "}
                    <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;