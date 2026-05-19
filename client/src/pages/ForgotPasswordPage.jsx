import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axios";

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    
    // 2FA/Multi-factor Reset selection states
    const [mfaChoices, setMfaChoices] = useState(null);
    const [chosenMethod, setChosenMethod] = useState("");
    const [otpCode, setOtpCode] = useState("");

    const handleSubmitIdentifier = async (e) => {
        e.preventDefault();
        if (!identifier.trim()) return;

        setIsLoading(true);
        setError("");
        setSuccessMessage("");

        try {
            const { data } = await axiosInstance.post("/auth/forgot-password", {
                identifier: identifier.trim()
            });

            if (data.mfaRequired) {
                // User has 2FA enabled, show method selection options
                setMfaChoices(data);
            } else {
                setSuccessMessage(data.message || "Reset link/code has been sent successfully.");
                if (data.method === "phone") {
                    setChosenMethod("phone");
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectMethod = async (method) => {
        setIsLoading(true);
        setError("");
        setSuccessMessage("");

        try {
            const { data } = await axiosInstance.post("/auth/forgot-password", {
                identifier: identifier.trim(),
                method
            });
            setSuccessMessage(data.message || "Reset instructions sent.");
            setChosenMethod(method);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to dispatch reset instructions.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (otpCode.length < 6) return;

        setIsLoading(true);
        setError("");

        try {
            const { data } = await axiosInstance.post("/auth/forgot-password/verify-code", {
                identifier: identifier.trim(),
                code: otpCode.trim()
            });

            if (data.success && data.token) {
                // Manually verified successfully! Direct the user to the reset page
                navigate(`/reset-password/${data.token}`);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Invalid or expired verification code.");
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

                <h1 className="auth-title">Reset Password</h1>

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

                {/* Step 1: Input Identifier */}
                {!mfaChoices && !chosenMethod && (
                    <>
                        <p className="auth-subtitle">Enter your email address or phone number associated with your account</p>
                        <form onSubmit={handleSubmitIdentifier} className="auth-form">
                            <div className="field">
                                <label htmlFor="identifier">Email or Phone Number</label>
                                <input
                                    id="identifier"
                                    type="text"
                                    required
                                    placeholder="you@example.com or +1234567890"
                                    value={identifier}
                                    onChange={(e) => {
                                        setIdentifier(e.target.value);
                                        setError("");
                                    }}
                                    style={{ fontSize: "1.05rem" }}
                                />
                            </div>

                            <button type="submit" className="btn-primary" disabled={isLoading || !identifier.trim()}>
                                {isLoading ? "Checking..." : "Continue"}
                            </button>
                        </form>
                    </>
                )}

                {/* Step 2: 2FA Choice Selection */}
                {mfaChoices && !chosenMethod && (
                    <>
                        <p className="auth-subtitle" style={{ marginBottom: "20px" }}>This account has Two-Factor Authentication enabled. Choose where you would like to receive the reset confirmation:</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                            {mfaChoices.hasEmail && (
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => handleSelectMethod("email")}
                                    disabled={isLoading}
                                    style={{ background: "rgba(61, 165, 217, 0.15)", color: "#3da5d9", border: "1px solid rgba(61, 165, 217, 0.3)" }}
                                >
                                    Get Reset Link via Email
                                </button>
                            )}
                            {mfaChoices.hasPhone && (
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => handleSelectMethod("phone")}
                                    disabled={isLoading}
                                    style={{ background: "rgba(61, 165, 217, 0.15)", color: "#3da5d9", border: "1px solid rgba(61, 165, 217, 0.3)" }}
                                >
                                    Get Code via SMS (Phone)
                                </button>
                            )}
                        </div>
                    </>
                )}

                {/* Step 3: Phone Code Manual Verification */}
                {chosenMethod === "phone" && (
                    <>
                        <p className="auth-subtitle">Enter the 6-digit confirmation code sent to your phone number manually to proceed</p>
                        <form onSubmit={handleVerifyOtp} className="auth-form">
                            <div className="field">
                                <label htmlFor="otpCode">6-Digit Reset Code</label>
                                <input
                                    id="otpCode"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    required
                                    placeholder="0 0 0 0 0 0"
                                    value={otpCode}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "");
                                        setOtpCode(val);
                                        setError("");
                                    }}
                                    style={{
                                        textAlign: "center",
                                        fontSize: "1.6rem",
                                        letterSpacing: "6px",
                                        fontFamily: "monospace",
                                        background: "rgba(30, 41, 59, 0.6)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#fff"
                                    }}
                                />
                            </div>

                            <button type="submit" className="btn-primary" disabled={isLoading || otpCode.length < 6}>
                                {isLoading ? "Verifying..." : "Verify & Continue"}
                            </button>
                        </form>
                    </>
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
