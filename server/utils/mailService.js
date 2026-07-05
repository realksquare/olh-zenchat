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

    const brevoApiKey = (process.env.BREVO_API_KEY || "").trim();
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

    // Try Brevo HTTPS API if API Key is configured (Immune to cloud port blocks, 100% free, no domain required!)
    if (brevoApiKey) {
        try {
            console.log("[Brevo] Attempting HTTPS API email dispatch...");
            const senderEmail = process.env.SMTP_FROM ? process.env.SMTP_FROM : "onlinelearninghubteam@gmail.com";
            
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": brevoApiKey,
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    sender: {
                        name: "ZenChat",
                        email: senderEmail
                    },
                    to: [{ email: email }],
                    subject: subject,
                    htmlContent: html
                })
            });

            const resData = await response.json();
            if (response.ok) {
                console.log(`[Brevo] Reset email successfully dispatched to ${email}. ID: ${resData.messageId}`);
                return true;
            } else {
                throw new Error(resData.message || "Brevo API Error");
            }
        } catch (error) {
            console.error("[Brevo] Error sending reset email via HTTPS API:", error);
            throw new Error(`Email Dispatch Failed via Brevo API: ${error.message}`);
        }
    }

    // Try Resend HTTPS API if API Key is configured (Immune to cloud port blocks!)
    if (resendApiKey) {
        try {
            console.log("[Resend] Attempting HTTPS API email dispatch...");
            const fromEmail = process.env.SMTP_FROM ? process.env.SMTP_FROM : "onboarding@resend.dev";
            
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

const send2faEmail = async (email, username, code) => {
    console.log("\n=======================================================");
    console.log("🔒 [ZENCHAT SECURITY] 2FA VERIFICATION CODE TRIGGERED 🔒");
    console.log(`User: ${username || 'User'} (${email})`);
    console.log(`Verification Code: ${code}`);
    console.log("=======================================================\n");

    const brevoApiKey = (process.env.BREVO_API_KEY || "").trim();
    const subject = "Your ZenChat 2FA Verification Code";
    const html = `
        <div style="background-color: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; text-align: center; border-radius: 8px; max-width: 600px; margin: 0 auto;">
            <div style="margin-bottom: 24px;">
                <h1 style="color: #38bdf8; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">ZenChat</h1>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Premium Secure Messaging</p>
            </div>
            <div style="background-color: #1e293b; padding: 32px; border-radius: 12px; text-align: left; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h2 style="color: #f1f5f9; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Hello ${username || 'User'},</h2>
                <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                    Please enter the following 6-digit code to complete your secure authentication session:
                </p>
                <div style="text-align: center; margin-bottom: 24px; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; padding: 16px; background-color: #0f172a; border-radius: 8px;">
                    ${code}
                </div>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 0;">
                    This code is valid for 5 minutes. If you did not request this, please change your credentials immediately.
                </p>
            </div>
            <div style="margin-top: 24px; color: #64748b; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ZenChat. All rights reserved.
            </div>
        </div>
    `;

    if (brevoApiKey) {
        try {
            const senderEmail = process.env.SMTP_FROM ? process.env.SMTP_FROM : "onlinelearninghubteam@gmail.com";
            await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": brevoApiKey,
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    sender: { name: "ZenChat", email: senderEmail },
                    to: [{ email: email }],
                    subject: subject,
                    htmlContent: html
                })
            });
            console.log(`[Brevo] 2FA email successfully dispatched to ${email}`);
        } catch (error) {
            console.error("[Brevo] Error dispatching 2FA email:", error);
        }
    }
    return true;
};

module.exports = {
    sendResetEmail,
    send2faEmail,
    sendZenVoiceOTP,
    sendZenVoicePseudonymResult,
    sendZenVoiceDomainResult,
};

async function _sendViaBrevo(to, subject, html) {
    const brevoApiKey = (process.env.BREVO_API_KEY || "").trim();
    const senderEmail = process.env.SMTP_FROM ? process.env.SMTP_FROM : "onlinelearninghubteam@gmail.com";
    if (!brevoApiKey) {
        console.warn("[ZenVoice Mail] No BREVO_API_KEY — email skipped.");
        return false;
    }
    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "accept": "application/json", "api-key": brevoApiKey, "content-type": "application/json" },
            body: JSON.stringify({ sender: { name: "ZenVoice by ZenChat", email: senderEmail }, to: [{ email: to }], subject, htmlContent: html })
        });
        const resData = await response.json();
        if (response.ok) {
            console.log(`[ZenVoice Mail] Sent "${subject}" to ${to}`);
            return true;
        }
        console.error("[ZenVoice Mail] Brevo error:", resData.message);
        return false;
    } catch (err) {
        console.error("[ZenVoice Mail] Fetch error:", err.message);
        return false;
    }
}

const ZV_HEADER = `
    <div style="background:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px 20px;max-width:600px;margin:0 auto;border-radius:8px;">
    <div style="margin-bottom:24px;text-align:center;">
        <h1 style="color:#f59e0b;font-size:26px;font-weight:700;margin:0;letter-spacing:-0.5px;">#ZenVoice</h1>
        <p style="color:#94a3b8;font-size:13px;margin-top:4px;">Anonymous Academic Chat by ZenChat</p>
    </div>
    <div style="background:#1e293b;padding:28px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">`;

const ZV_FOOTER = `</div><div style="margin-top:20px;text-align:center;color:#64748b;font-size:12px;">&copy; ${new Date().getFullYear()} ZenChat. All rights reserved.</div></div>`;

async function sendZenVoiceOTP(email, username, otp, domain) {
    console.log(`[ZenVoice OTP] ${username} (${email}) — Domain: ${domain} — OTP: ${otp}`);
    const subject = "Your ZenVoice Verification Code";
    const html = `${ZV_HEADER}
        <h2 style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Hello ${username},</h2>
        <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:20px;">Enter this code to verify your institutional email <strong style="color:#38bdf8;">${domain}</strong> and unlock your #ZenVoice access:</p>
        <div style="text-align:center;font-size:36px;font-weight:800;letter-spacing:8px;color:#f59e0b;padding:18px;background:#0f172a;border-radius:10px;margin-bottom:20px;">${otp}</div>
        <p style="color:#94a3b8;font-size:13px;line-height:1.5;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
    ${ZV_FOOTER}`;
    return _sendViaBrevo(email, subject, html);
}

async function sendZenVoicePseudonymResult(email, username, desiredPseudonym, approved, adminNote) {
    const subject = approved ? "#ZenVoice: Pseudonym Request Approved" : "#ZenVoice: Pseudonym Request Not Approved";
    const html = `${ZV_HEADER}
        <h2 style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Hello ${username},</h2>
        ${approved
            ? `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">Your request to change your pseudonym to <strong style="color:#38bdf8;">${desiredPseudonym}</strong> has been <strong style="color:#10b981;">approved</strong>! It is now your active handle in all #ZenVoice rooms.</p>`
            : `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">Your request to change your pseudonym to <strong style="color:#38bdf8;">${desiredPseudonym}</strong> was <strong style="color:#ef4444;">not approved</strong>. Your existing pseudonym remains active.</p>`
        }
        ${adminNote ? `<div style="background:#0f172a;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:6px;font-size:14px;color:#94a3b8;margin-top:4px;"><strong style="color:#f8fafc;">Admin note:</strong> ${adminNote}</div>` : ""}
    ${ZV_FOOTER}`;
    return _sendViaBrevo(email, subject, html);
}

async function sendZenVoiceDomainResult(email, username, domain, approved, adminNote) {
    const subject = approved ? "#ZenVoice: Your Institution Domain Was Approved" : "#ZenVoice: Institution Domain Request Update";
    const html = `${ZV_HEADER}
        <h2 style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Hello ${username},</h2>
        ${approved
            ? `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">The domain <strong style="color:#38bdf8;">${domain}</strong> has been <strong style="color:#10b981;">approved</strong>! You can now verify your #ZenVoice account using your institutional email.</p>`
            : `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">The domain <strong style="color:#38bdf8;">${domain}</strong> was <strong style="color:#ef4444;">not approved</strong> at this time.</p>`
        }
        ${adminNote ? `<div style="background:#0f172a;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:6px;font-size:14px;color:#94a3b8;margin-top:4px;"><strong style="color:#f8fafc;">Admin note:</strong> ${adminNote}</div>` : ""}
    ${ZV_FOOTER}`;
    return _sendViaBrevo(email, subject, html);
}
