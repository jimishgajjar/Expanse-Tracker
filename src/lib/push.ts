import webpush from "web-push";

const PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || `mailto:${(process.env.SMTP_FROM || "expensetracker@jimishgajjar.com").replace(/.*<|>.*/g, "")}`;

let configured = false;
function ensure(): boolean {
  if (!PUBLIC || !PRIVATE) return false;
  if (!configured) {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  }
  return true;
}

export function pushConfigured(): boolean {
  return !!(PUBLIC && PRIVATE);
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Send one push. `gone` = the subscription is dead (404/410) and should be deleted. */
export async function sendPushToSub(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensure()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true, gone: false };
  } catch (e) {
    const code = (e as { statusCode?: number })?.statusCode;
    return { ok: false, gone: code === 404 || code === 410 };
  }
}
