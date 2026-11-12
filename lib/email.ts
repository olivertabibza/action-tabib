/**
 * Transactional email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Server-only: the key is a plain (not NEXT_PUBLIC_) env var, read only by
 * Server Actions.
 *
 * Configuration (Vercel env vars, and .env.local for localhost):
 *   RESEND_API_KEY  a Resend API key with sending access
 *   EMAIL_FROM      a sender on the domain verified in Resend,
 *                   e.g. "Action <hello@yourdomain.com>"
 * Without both, sendEmail() does nothing and says so in the server log, so
 * the app works the same until email is set up.
 */

type Email = { to: string; subject: string; text: string };

export async function sendEmail({ to, subject, text }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) {
    console.info(`[email] skipped "${subject}": RESEND_API_KEY or EMAIL_FROM is not set`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      console.error(`[email] "${subject}" failed: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    // Never fail the action that triggered it: the decision is already saved.
    console.error(`[email] "${subject}" failed:`, e);
  }
}

/** The approval / rejection email for a professional application (PX F15). */
export function applicationDecisionEmail({
  name,
  decision,
  reason,
  origin,
}: {
  name: string | null;
  decision: "approved" | "rejected";
  reason: string | null;
  origin: string;
}): { subject: string; text: string } {
  const hi = `Hi ${name?.trim() || "there"},`;
  if (decision === "approved") {
    return {
      subject: "You're in: welcome to Action",
      text: [
        hi,
        "",
        "Your professional profile on Action has been approved. You can now post and apply to projects, take classes and message other members.",
        "",
        `Log in to get started: ${origin}/login`,
        "",
        "The Action team",
      ].join("\n"),
    };
  }
  return {
    subject: "An update on your Action application",
    text: [
      hi,
      "",
      "Thanks for applying to Action. We weren't able to approve your professional profile this time.",
      ...(reason ? ["", "From the reviewer:", reason] : []),
      "",
      `You can see this any time when you log in: ${origin}/login`,
      "",
      "The Action team",
    ].join("\n"),
  };
}
