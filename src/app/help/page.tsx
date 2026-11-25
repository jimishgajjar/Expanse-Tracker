import Link from "next/link";
import { Eye, Archive, Download, TriangleAlert, LifeBuoy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { pilotAvailable } from "@/lib/pilot-release";
import { PageShell } from "@/components/page-shell";

function Topic({ icon: TopicIcon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border/70 py-5 first:border-t-0 first:pt-0">
      <span className="row-span-2 mt-0.5 grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
        <TopicIcon className="size-4" aria-hidden />
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="page-prose space-y-2">{children}</div>
    </section>
  );
}

export default function Help() {
  return (
    <PageShell back={{ href: "/", label: "Overview" }} title="Privacy and help" description="How household records, exports and support work." width="narrow" touch>
      <div className="dashboard-panel p-4 sm:p-6">
        <Topic icon={Eye} title="Who can see records?">
          <p>People with access to a tracker can see that tracker’s shared activity. Check your selected tracker and its members before adding personal details. The operator handles the database and recovery copies.</p>
        </Topic>
        <Topic icon={Archive} title="What is retained?">
          <p>Saved entries, changes and reviews remain in the tracker. Closing a login can leave shared entries in trackers owned by other people. Encrypted recovery copies may retain older records until the operator removes those copies. Ask the operator about the retention period for your deployment.</p>
        </Topic>
        <Topic icon={Download} title="Export or close an account">
          <p>In Settings, export every tracker you need and open the files to check them. Large activity histories can be downloaded in parts. To close a login, use Delete my account and confirm with your current password. Resolve shared ownership and pending invitations first.</p>
          <Link href="/?tab=settings" className="text-link text-sm">Open Settings</Link>
        </Topic>
        <Topic icon={TriangleAlert} title="Current limitations">
          <p>Manual records and reviewed file imports are separate from bank connections. Live bank sync is unavailable in this pilot. Forecasts depend on the amounts and dates entered. Offline mobile behavior still needs verification on a physical phone.</p>
        </Topic>
        <Topic icon={LifeBuoy} title="Report a problem">
          <p>If an amount or household access looks wrong, pause the affected task. Keep the reference shown on the error screen. Share the steps you took with the pilot operator and leave out bank details, financial records and passwords.</p>
          {pilotAvailable() && <Link href="/feedback" className="text-link text-sm">Send private pilot feedback</Link>}
        </Topic>
      </div>
    </PageShell>
  );
}
