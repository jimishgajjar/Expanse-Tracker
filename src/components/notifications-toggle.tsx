"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { savePushSubscription, removePushSubscription } from "@/lib/push-actions";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationsToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("Notifications were blocked in this browser."); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID!) as BufferSource });
      const keys = sub.toJSON().keys;
      if (!keys?.p256dh || !keys?.auth) { toast.error("Couldn't read subscription keys."); return; }
      const res = await savePushSubscription({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth });
      if (res.ok) { setEnabled(true); toast.success("Notifications enabled on this device."); }
      else toast.error("Couldn't save the subscription.");
    } catch {
      toast.error("Couldn't enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setEnabled(false);
      toast.success("Notifications disabled on this device.");
    } catch {
      toast.error("Couldn't disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return <p className="text-xs text-muted-foreground">Push notifications aren&apos;t available in this browser{!VAPID ? " (not configured)" : ""}. On iPhone, add this site to your Home Screen first.</p>;
  }

  return (
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={enabled ? disable : enable} disabled={busy || supported === null}>
      {enabled ? <><BellOff className="size-4" /> Turn off notifications on this device</> : <><Bell className="size-4" /> Enable phone / desktop notifications</>}
    </Button>
  );
}
