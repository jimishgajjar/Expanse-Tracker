import Link from "next/link";
import { pilotAvailable } from "@/lib/pilot-release";
export default function Help(){
  return <main className="pilot-content mx-auto max-w-2xl space-y-5 px-4 py-8"><Link href="/" className="text-brand underline">← Expense Tracker</Link>
    <header><h1 className="text-2xl font-semibold">Privacy and help</h1><p className="text-sm text-muted-foreground">How household records, exports and support work.</p></header>
    <section><h2 className="font-semibold">Who can see records?</h2><p>People with access to a tracker can see that tracker’s shared activity. Check your selected tracker and its members before adding personal details. The operator handles the database and recovery copies.</p></section>
    <section><h2 className="font-semibold">What is retained?</h2><p>Saved entries, changes and reviews remain in the tracker. Closing a login can leave shared entries in trackers owned by other people. Encrypted recovery copies may retain older records until the operator removes those copies. Ask the operator about the retention period for your deployment.</p></section>
    <section><h2 className="font-semibold">Export or close an account</h2><p>In Settings, export every tracker you need and open the files to check them. Large activity histories can be downloaded in parts. To close a login, use Delete my account and confirm with your current password. Resolve shared ownership and pending invitations first.</p><Link href="/?tab=settings" className="text-brand underline">Open Settings</Link></section>
    <section><h2 className="font-semibold">Current limitations</h2><p>Manual records and reviewed file imports are separate from bank connections. Live bank sync is unavailable in this pilot. Forecasts depend on the amounts and dates entered. Offline mobile behavior still needs verification on a physical phone.</p></section>
    <section><h2 className="font-semibold">Report a problem</h2><p>If an amount or household access looks wrong, pause the affected task. Keep the reference shown on the error screen. Share the steps you took with the pilot operator and leave out bank details, financial records and passwords.</p>
    {pilotAvailable() && <Link href="/feedback" className="text-brand underline">Send private pilot feedback</Link>}</section></main>;
}
