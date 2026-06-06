// Branded, email-client-safe HTML for every email the app sends (alerts, verify,
// reset, invites). Table layout + inline styles for Gmail/Outlook/Apple Mail, with
// a preheader, a details card, a bulletproof CTA button, and dark-mode support.

export type EmailRow = { label: string; value: string };
export type EmailDetail = { amount?: string; tone?: "income" | "expense" | "neutral"; rows?: EmailRow[] };

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const BRAND = "#047857"; // deep emerald
const INK = "#0f172a";
const BODY = "#475569";
const MUTED = "#94a3b8";
const LINE = "#e7ebf0";

const toneColor = (t?: string) => (t === "expense" ? "#e11d48" : t === "income" ? "#047857" : INK);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const escapeHtml = esc;

export function renderEmail(opts: {
  preheader?: string;
  heading: string;
  intro: string;
  detail?: EmailDetail;
  cta?: { label: string; url: string };
  footnote?: string;
}): string {
  const { preheader = "", heading, intro, detail, cta, footnote } = opts;

  const detailHtml = detail
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="detail" style="background:#f6f8fa;border:1px solid ${LINE};border-radius:12px;margin:0 0 26px;">
         <tr><td style="padding:18px 20px;">
           ${detail.amount ? `<div class="amt" style="font-family:${FONT};font-size:28px;font-weight:700;letter-spacing:-0.02em;color:${toneColor(detail.tone)};padding-bottom:${detail.rows?.length ? "12px" : "0"};">${esc(detail.amount)}</div>` : ""}
           ${(detail.rows ?? [])
             .map(
               (r, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                 <td class="sub" style="font-family:${FONT};font-size:13px;color:#64748b;padding:8px 0;${i || detail.amount ? `border-top:1px solid #eef1f4;` : ""}">${esc(r.label)}</td>
                 <td class="ink" align="right" style="font-family:${FONT};font-size:13px;font-weight:600;color:${INK};padding:8px 0;${i || detail.amount ? `border-top:1px solid #eef1f4;` : ""}">${esc(r.value)}</td>
               </tr></table>`,
             )
             .join("")}
         </td></tr>
       </table>`
    : "";

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
         <td align="center" bgcolor="${BRAND}" style="border-radius:10px;">
           <a href="${cta.url}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(cta.label)} &rarr;</a>
         </td>
       </tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(heading)}</title>
<style>
  body{margin:0;padding:0;background:#f4f6f8;-webkit-font-smoothing:antialiased;}
  table{border-collapse:collapse;} img{border:0;}
  @media (max-width:620px){ .container{width:100%!important;} .px{padding-left:22px!important;padding-right:22px!important;} }
  @media (prefers-color-scheme:dark){
    body,.bg{background:#0e1116!important;}
    .card{background:#161a20!important;border-color:#262c34!important;}
    .detail{background:#1b2026!important;border-color:#2a313a!important;}
    .ink{color:#f1f5f9!important;} .body{color:#c7d0db!important;} .sub{color:#9aa6b2!important;}
  }
</style></head>
<body class="bg" style="margin:0;padding:0;background:#f4f6f8;">
  <span style="display:none!important;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader || intro)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#f4f6f8;">
    <tr><td align="center" style="padding:30px 12px;">
      <table role="presentation" width="600" class="container" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr><td class="px" style="padding:2px 8px 18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:10px;">
              <div style="width:34px;height:34px;background:${BRAND};border-radius:9px;text-align:center;line-height:34px;color:#ffffff;font-weight:700;font-family:${FONT};font-size:18px;">$</div>
            </td>
            <td class="ink" style="font-family:${FONT};font-size:17px;font-weight:700;color:${INK};">Expense&nbsp;Tracker</td>
          </tr></table>
        </td></tr>
        <tr><td class="card" style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" style="padding:30px 34px 34px;">
            <h1 class="ink" style="margin:0 0 8px;font-family:${FONT};font-size:21px;font-weight:700;color:${INK};letter-spacing:-0.01em;">${esc(heading)}</h1>
            <p class="body" style="margin:0 0 24px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">${intro}</p>
            ${detailHtml}
            ${ctaHtml}
          </td></tr></table>
        </td></tr>
        <tr><td class="px sub" style="padding:20px 12px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
          ${footnote ?? "Expense Tracker · personal &amp; shared money tracking."}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
