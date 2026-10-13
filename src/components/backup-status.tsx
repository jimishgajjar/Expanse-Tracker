"use client";
import { useState } from "react";
import { useRemoteData } from "./use-remote-data";
import { Button } from "./ui/button";
export function BackupStatus() {
  const {data,error,retry} = useRemoteData<{report:null|{verifiedAt:string;destination:string}}>("/api/backup-status");
  const [now] = useState(() => Date.now());
  const age = data?.report ? now-new Date(data.report.verifiedAt).getTime() : 0;
  return <section className="dashboard-panel space-y-2 p-4"><h2 className="text-sm font-semibold">Verified backups</h2>{error ? <div role="alert">{error}<Button onClick={retry}>Retry</Button></div> : !data ? <p role="status" className="text-xs text-muted-foreground">Checking backup status…</p> : data.report ? <><p className="text-sm">Last restore verification: <time dateTime={data.report.verifiedAt}>{new Date(data.report.verifiedAt).toLocaleString()}</time></p><p className="text-xs text-muted-foreground">{data.report.destination}. {age > 48*60*60*1000 ? "Backup is over 48 hours old. Check that the backup computer is on and its scheduled task succeeds." : "Daily backups require the backup computer to be available."}</p></> : <p className="text-sm text-muted-foreground">No verified backup has been reported for this workspace. An Excel export is not a complete recovery backup.</p>}</section>;
}
