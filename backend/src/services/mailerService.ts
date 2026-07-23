import { env } from "../config/env.js";

interface Mailer {
  sendVerification(to: string, link: string): Promise<void>;
  sendPasswordReset(to: string, link: string): Promise<void>;
  sendInvite(to: string, link: string, role: string): Promise<void>;
}

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
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  }
}

const resendMailer: Mailer = {
  async sendVerification(to, link) {
    await sendViaResend(
      to,
      "Verify your Centoire email",
      `<p>Welcome to Centoire. Confirm your email to start posting:</p><p><a href="${link}">Verify email</a></p>`,
    );
  },
  async sendPasswordReset(to, link) {
    await sendViaResend(
      to,
      "Reset your Centoire password",
      `<p>Reset your password using the link below. It expires in 1 hour.</p><p><a href="${link}">Reset password</a></p>`,
    );
  },
  async sendInvite(to, link, role) {
    await sendViaResend(
      to,
      "You're invited to join Centoire",
      `<p>You've been invited to join Centoire as a <strong>${role}</strong>.</p><p><a href="${link}">Accept invite</a></p><p>This link expires in 14 days.</p>`,
    );
  },
};

export const mailer: Mailer = env.RESEND_API_KEY ? resendMailer : consoleMailer;
