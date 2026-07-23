import { env } from "../config/env.js";

interface Mailer {
  sendVerification(to: string, link: string): Promise<void>;
  sendPasswordReset(to: string, link: string): Promise<void>;
  sendInvite(to: string, link: string, role: string): Promise<void>;
}

// ─── HTML shell ───────────────────────────────────────────────────────────────

function emailShell(title: string, previewText: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F4F0;font-family:Georgia,'Times New Roman',serif;">
  <!-- Preview text (hidden, shows in inbox snippet) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F7F4F0;">
    ${previewText}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F4F0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Crimson header -->
          <tr>
            <td style="background-color:#DC143C;padding:28px 40px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;line-height:1.2;">Centoire</p>
              <p style="margin:5px 0 0;font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:0.10em;text-transform:uppercase;">Fashion Intelligence</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 40px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F7F4F0;padding:20px 40px;border-top:1px solid #E8E0D8;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#999999;line-height:1.7;">
                You're receiving this because you have a Centoire account.<br />
                If you didn't request this, you can safely ignore it — your account remains secure.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── CTA button helper ────────────────────────────────────────────────────────

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td style="border-radius:8px;background-color:#DC143C;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>
  <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;word-break:break-all;">
    Or copy this link: <a href="${url}" style="color:#DC143C;">${url}</a>
  </p>`;
}

// ─── Template bodies ──────────────────────────────────────────────────────────

function verificationBody(link: string): string {
  return `
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#1A1A1A;letter-spacing:-0.3px;">Confirm your email</h1>
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:16px;color:#555555;line-height:1.6;">
      Welcome to Centoire. Click the button below to verify your email address and unlock posting and commenting.
    </p>
    ${ctaButton("Verify email address", link)}
    <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#aaaaaa;line-height:1.5;">
      This link expires in <strong>24 hours</strong>. After that, log in and request a new verification email.
    </p>`;
}

function passwordResetBody(link: string): string {
  return `
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#1A1A1A;letter-spacing:-0.3px;">Reset your password</h1>
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:16px;color:#555555;line-height:1.6;">
      We received a request to reset the password for your Centoire account. Click below to choose a new one.
    </p>
    ${ctaButton("Reset password", link)}
    <p style="margin:20px 0 8px;font-family:Arial,sans-serif;font-size:13px;color:#aaaaaa;line-height:1.5;">
      This link expires in <strong>1 hour</strong>.
    </p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#DC143C;line-height:1.5;">
      If you didn't request a password reset, your account is safe — you can safely ignore this email.
    </p>`;
}

function inviteBody(link: string, role: string): string {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  return `
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#1A1A1A;letter-spacing:-0.3px;">You're invited to Centoire</h1>
    <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:16px;color:#555555;line-height:1.6;">
      You've been selected as a <strong>${roleLabel}</strong> on Centoire — a fashion intelligence platform where the best voices in the industry share what matters.
    </p>

    <!-- Benefits callout box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#FFF8F0;border:1px solid #E8D4C0;border-radius:10px;padding:20px 24px;">
          <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#1A1A1A;">As a Creator, your content gets special treatment:</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#444444;">
                &rarr;&nbsp; Your posts <strong>rank higher</strong> in feeds for every reader
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#444444;">
                &rarr;&nbsp; Every post you write displays a&nbsp;<span style="display:inline-block;background:#DC143C;color:#ffffff;padding:1px 8px;border-radius:9999px;font-size:10px;font-weight:700;letter-spacing:0.06em;vertical-align:middle;">MUST READ</span>&nbsp;badge
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#444444;">
                &rarr;&nbsp; Early access to new Centoire features and tools
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${ctaButton("Accept invite & create your account", link)}
    <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#aaaaaa;line-height:1.5;">
      This invite is personal to this email address and expires in <strong>14 days</strong>.
    </p>`;
}

// ─── Console fallback (dev / no API key) ─────────────────────────────────────

const consoleMailer: Mailer = {
  async sendVerification(to, link) {
    console.log(`[mail] verify ${to}: ${link}`);
  },
  async sendPasswordReset(to, link) {
    console.log(`[mail] password reset ${to}: ${link}`);
  },
  async sendInvite(to, link, role) {
    console.log(`[mail] invite (${role}) ${to}: ${link}`);
  },
};

// ─── Resend transport ─────────────────────────────────────────────────────────

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

const resendMailer: Mailer = {
  async sendVerification(to, link) {
    await sendViaResend(
      to,
      "Confirm your Centoire email",
      emailShell(
        "Confirm your email — Centoire",
        "Click to verify your email address and start posting on Centoire.",
        verificationBody(link),
      ),
    );
  },

  async sendPasswordReset(to, link) {
    await sendViaResend(
      to,
      "Reset your Centoire password",
      emailShell(
        "Reset your password — Centoire",
        "Use the link below to reset your password. It expires in 1 hour.",
        passwordResetBody(link),
      ),
    );
  },

  async sendInvite(to, link, role) {
    await sendViaResend(
      to,
      `You're invited to join Centoire as a ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      emailShell(
        "You're invited to Centoire",
        "You've been selected as a Creator on Centoire. Accept your invite to get started.",
        inviteBody(link, role),
      ),
    );
  },
};

// ─── Export active mailer ─────────────────────────────────────────────────────

export const mailer: Mailer = env.RESEND_API_KEY ? resendMailer : consoleMailer;
