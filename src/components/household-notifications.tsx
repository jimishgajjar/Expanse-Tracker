"use client";

import { useEffect, useState } from "react";
import { deliveryChannels, type DeliveryChannel, type NotificationOptions, type NotificationTopic } from "@/lib/notification-options";
import { useSettings } from "./settings-provider";
import { NotificationsToggle } from "./notifications-toggle";

export function HouseholdNotifications() {
  const {workspace,actor} = useSettings();
  if (!workspace) return <p className="text-xs text-muted-foreground">Open a tracker to choose your notifications.</p>;
  return <NotificationChoices key={workspace + ":" + actor} workspace={workspace} />;
}

function NotificationChoices({workspace}: {workspace:string}) {
  const url = "/api/mobile/notification-preferences?workspace=" + encodeURIComponent(workspace);
  const [data,setData] = useState<NotificationOptions>();
  const [attempt,setAttempt] = useState(0);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [status,setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(url,{cache:"no-store",signal:controller.signal}).then(async response => {
      if (!response.ok) throw Error();
      const options: NotificationOptions = await response.json();
      if (!controller.signal.aborted) setData(options);
    }).catch(() => { if (!controller.signal.aborted) setError("Couldn’t load your choices."); });
    return () => controller.abort();
  },[url,attempt]);

  async function save(topic:NotificationTopic, channel:DeliveryChannel, enabled:boolean) {
    setBusy(true); setStatus("");
    try {
      const response = await fetch(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,channel,enabled})});
      if (!response.ok) throw Error();
      setData(await response.json());
      setStatus("Choice saved.");
    } catch {
      setError("Couldn’t confirm this change. Reload your choices to check.");
    } finally { setBusy(false); }
  }

  if (error) return <div className="space-y-2 text-xs"><p role="alert">{error}</p><button type="button" className="text-brand underline"
    onClick={() => {setError("");setData(undefined);setAttempt(n => n+1);}}>Reload choices</button></div>;
  if (!data) return <p role="status" className="text-xs text-muted-foreground">Loading your choices…</p>;
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">Invitation choices apply across your account. Other choices apply only to this household. Mentions notify you when someone selects you in a shared transaction comment.</p>
    <table className="w-full text-left text-xs">
      <caption className="sr-only">Your reminders and delivery channels</caption>
      <thead><tr className="border-b text-muted-foreground"><th scope="col" className="py-2 font-medium">Notification</th>
        <th scope="col" className="text-center font-medium">Email</th><th scope="col" className="text-center font-medium">Push</th></tr></thead>
      <tbody>{data.choices.map(row => <tr key={row.topic} className="border-b border-border/60">
        <th scope="row" className="py-2 font-medium">{row.label}</th>
        {deliveryChannels.map(channel => <td key={channel} className="text-center"><label className="inline-flex min-h-9 min-w-9 items-center justify-center">
          <input type="checkbox" className="size-4 accent-brand" aria-label={row.label+" by "+channel} checked={row[channel]}
            disabled={busy || (channel === "email" && !data.emailVerified && !row.email)} onChange={event => void save(row.topic,channel,event.target.checked)} />
        </label></td>)}
      </tr>)}</tbody>
    </table>
    {!data.emailVerified && <p className="text-xs text-muted-foreground">Verify your account email to receive email updates.</p>}
    <p className="text-xs text-muted-foreground">{data.preview ? "Local preview saves these choices without sending email or push." : "Push uses the devices you enable. Lock-screen notices keep amounts and account details private."}</p>
    <NotificationsToggle />
    <span role="status" className="text-xs text-muted-foreground">{busy ? "Saving…" : status}</span>
  </div>;
}
