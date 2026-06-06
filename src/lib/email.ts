// Resend's SMTP password is the same `re_…` API key the HTTP API uses, so we
// accept either RESEND_API_KEY or the SMTP_PASS people paste from the dashboard.
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
const FROM = process.env.EMAIL_FROM || process.env.SMTP_FROM || "Expense Tracker <onboarding@resend.dev>";

/** Send an email via Resend. With no RESEND_API_KEY, logs to the server console
 *  (so password-reset links are still discoverable in local dev). */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`\n──── [email:dev] no RESEND_API_KEY, logging instead ────\nTo: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}\n────────────────────────────────────────\n`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) console.error("[email] Resend error:", res.status, await res.text());
  } catch (e) {
    console.error("[email] send failed:", e);
  }
}
