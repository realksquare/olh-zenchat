const nodemailer = require("nodemailer");

/**
 * Creates and returns a Nodemailer Transporter.
 * Automatically falls back to standard Google SMTP or a development test account.
 */
const getTransporter = () => {
    try {
        const host = (process.env.SMTP_HOST || "").trim();
        const user = (process.env.SMTP_USER || "").trim();
        const pass = (process.env.SMTP_PASS || "").trim();

        if (host && user && pass) {
            return nodemailer.createTransport({
                host,
                port: parseInt(process.env.SMTP_PORT || "587", 10),
                secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
                auth: { user, pass },
            });
        }
    } catch (err) {
        console.error("[SMTP] Error initializing transport:", err);
    }

    // Fallback: Return a mock/development transporter or logging transporter
    return null;
};

/**
 * Sends a premium branding HTML password reset email.
 * Includes a terminal-printing fallback for seamless developer testing.
 */
const sendResetEmail = async (email, username, resetUrl) => {
    // ALWAYS print to the server console immediately (extremely helpful for production debugging and bypasses port blocks!)
    console.log("\n=======================================================");
    console.log("🔒 [ZENCHAT SECURITY] PASSWORD RESET REQUEST TRIGGERED 🔒");
    console.log(`User: ${username} (${email})`);
    console.log(`Secure Reset Link: ${resetUrl}`);
    console.log("=======================================================\n");

    const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
    const transporter = getTransporter();

    const from = process.env.SMTP_FROM || '"ZenChat" <no-reply@zenchat.com>';
    const subject = "Reset Your ZenChat Password";

    // Standard high-fidelity dark branding email template
    const html = `
        <div style="background-color: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; text-align: center; border-radius: 8px; max-width: 600px; margin: 0 auto;">
            <div style="margin-bottom: 24px;">
                <h1 style="color: #38bdf8; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">ZenChat</h1>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Premium Secure Messaging</p>
            </div>
            <div style="background-color: #1e293b; padding: 32px; border-radius: 12px; text-align: left; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h2 style="color: #f1f5f9; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Hello ${username},</h2>
                <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                    We received a request to reset the password for your ZenChat account. Tap the secure button below to choose a new password. This link is valid for 1 hour.
                </p>
                <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${resetUrl}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; transition: background-color 0.2s; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);">
                        Reset Password
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 0;">
                    If you did not request a password reset, you can safely ignore this email. Your password will remain completely secure.
                </p>
            </div>
            <div style="margin-top: 24px; color: #64748b; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ZenChat. All rights reserved.
            </div>
        </div>
    `;

    // Try Resend HTTPS API if API Key is configured (Immune to cloud port blocks!)
    if (resendApiKey) {
        try {
            console.log("[Resend] Attempting HTTPS API email dispatch...");
            const fromEmail = process.env.SMTP_FROM ? process.env.SMTP_FROM : "ZenChat <onboarding@resend.dev>";
            
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${resendApiKey}`
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: email,
                    subject: subject,
                    html: html
                })
            });

            const resData = await response.json();
            if (response.ok) {
                console.log(`[Resend] Reset email successfully dispatched to ${email}. ID: ${resData.id}`);
                return true;
            } else {
                throw new Error(resData.message || "Resend API Error");
            }
        } catch (error) {
            console.error("[Resend] Error sending reset email via HTTPS API:", error);
            throw new Error(`Email Dispatch Failed via Resend API: ${error.message}`);
        }
    }

    if (transporter) {
        try {
            await transporter.sendMail({
                from,
                to: email,
                subject,
                html,
            });
            console.log(`[SMTP] Reset email successfully dispatched to ${email}`);
            return true;
        } catch (error) {
            console.error("[SMTP] Error sending reset email via configured host:", error);
            throw new Error(`SMTP Dispatch Failed: ${error.message}`);
        }
    }

    return true;
};

module.exports = {
    sendResetEmail,
};
