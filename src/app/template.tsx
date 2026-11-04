import { TrackerBoundary } from "@/components/tracker-boundary";
import { getSession } from "@/lib/session";
import { pilotAvailable } from "@/lib/pilot-release";
import { PilotTimingCollector } from "@/components/pilot-timings";

export default async function Template({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return session
    ? <TrackerBoundary key={session.viewKey} viewKey={session.viewKey}>{pilotAvailable() && <PilotTimingCollector/>}{children}</TrackerBoundary>
    : children;
}
