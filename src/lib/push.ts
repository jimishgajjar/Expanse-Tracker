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

/** Native (Expo) push tokens are stored with p256dh="expo" — route them to the
    Expo push service instead of web-push. */
async function sendExpoPush(token: string, payload: PushPayload): Promise<{ ok: boolean; gone: boolean }> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.url ? { url: payload.url } : {},
        sound: "default",
        channelId: "default",
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { data?: { status?: string; details?: { error?: string } } }
      | null;
    return { ok: json?.data?.status === "ok", gone: json?.data?.details?.error === "DeviceNotRegistered" };
  } catch {
    return { ok: false, gone: false };
  }
}

/** Send one push. `gone` = the subscription is dead and should be deleted. */
export async function sendPushToSub(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  if (sub.p256dh === "expo" || sub.endpoint.startsWith("ExponentPushToken")) {
    return sendExpoPush(sub.endpoint, payload);
  }
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
