/** Local blank session materials only. No enrollment, contact, database or provider access. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { phaseDecision, phaseEvidenceSchema } from "../src/lib/phase-decision";
import { statementDate } from "../src/lib/statement-review";

const repository=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const source=(name:string)=>readFileSync(join(repository,"docs",name),"utf8");
function worksheet(code:string){
  return `# ${code} — blank household observation sheet

Status: **Not enrolled. No observations recorded.** A reserved worksheet is not consent or an observed household.

Actual enrollment date: ______  Preview build: ______  Device class: ______
Observation consent: ______  Timing consent: ______  Follow-up contact consent: ______
Use role/household codes only. Keep identities and the contact key in separate restricted storage. Stop if observation is declined.

## Initial session

Follow the prompts and answer checks in [the facilitator guide](m11-household-observation.md). Keep its answer column out of the participant's view. Use a fresh synthetic tracker; do not use the live household or import real statements. Allow 25–35 minutes for the six core tasks. Plan separate optional M12/M13 sessions if the participant is tired.

Score U = unassisted, A = assisted, I = attempted but unfinished, – = not attempted. Record help before giving it. Leave timing blank when declined; a missing value is not zero.

| Task | U / A / I / – | Seconds if consented | Interface obstacle or help (no personal details) |
| --- | --- | --- | --- |
| Setup | | | |
| Capture after practice | | | |
| Import review | | | |
| Reconciliation | | | |
| Forecast | | | |
| Weekly review | | | |

M12: unassisted within 300 seconds ___; discrepancy identified ___; next action explained ___; receipt/resume verified ___.
M13: unchanged minimum/date explained ___; delayed income and protected cash explained ___; comparison explained ___; next action ___; assistance ___.
M13 overall: unassisted_correct / assisted_correct / incorrect / unfinished / unknown: ______.

Unexpected ledger movement or privacy incident reference: ______  Resolution status: ______
Facilitator fixture reset, if any (never count as participant completion): ______

## Follow-up

Enrollment is day 0. Observe voluntary returns during days 21–27 inclusive. Finalize the original household's outcome on day 28 or later. Run the phase report after adding actual enrollment to see exact dates. A prompted demonstration is not a voluntary return.

Window start: ______  Window end: ______  Readout date: ______
Observed return date in the window: ______  Voluntary review completed: ______
Outcome: waiting / unknown / returned / did_not_return / withdrawn: ______
How confirmed with consent: ______
One primary reason in the household's own account: ______
Interest: unknown / yes / no: ______  Stated monthly willingness: ______  Actual monthly payment: ______

Do not solicit payment for this exercise. Unknown payment stays blank; a verified zero means no payment. Before day 28 keep the phase evidence return/review/reason fields null. At readout retain unknowns and withdrawn outcomes; do not replace the household or label missing evidence a non-return. Respect withdrawal and the agreed deletion policy; do not retain identifiable notes against consent.
`;
}

try{
  if(process.argv.length!==3)throw Error("Provide the preparation date as YYYY-MM-DD.");
  const asOf=statementDate.parse(process.argv[2]);
  const evidence=phaseEvidenceSchema.parse(JSON.parse(source("phase-evidence.empty.json")));
  if(evidence.kind!=="uncollected"||evidence.households.length||Object.values(evidence.metrics.tasks).some(t=>t.attempted))
    throw Error("The committed template must contain no participant observations.");
  evidence.asOf=asOf;evidence.metrics.month=asOf.slice(0,7);
  const bytes=JSON.stringify(evidence,null,2)+"\n";
  const report={...phaseDecision(evidence),evidenceSha256:createHash("sha256").update(bytes).digest("hex")};
  const root=join(repository,"backups","pilot-sessions");
  for(const folder of [join(repository,"backups"),root]){
    if(existsSync(folder)&&(!lstatSync(folder).isDirectory()||lstatSync(folder).isSymbolicLink()))throw Error("Pilot folders must be directories, not links or junctions.");
    mkdirSync(folder,{recursive:true,mode:0o700});
  }
  // A fresh destination prevents a second preparation from replacing observations.
  const output=mkdtempSync(join(root,asOf+"-"));
  const write=(name:string,body:string)=>writeFileSync(join(output,name),body,{flag:"wx",mode:0o600});
  write("phase-evidence.json",bytes);write("phase-report.json",JSON.stringify(report,null,2)+"\n");
  for(const name of ["m11-household-observation.md","pilot-operations.md","pilot-statement.csv","pilot-evidence.empty.json"])
    write(name,source(name));
  for(const code of ["H01","H02","H03","H04","H05"])write(code+".md",worksheet(code));
  write("START-HERE.md",`# Five-household pilot packet

Prepared ${asOf}. **0/5 observed households. Enrollment has not started.**

No invitation, reminder, account, bank connection or database change was created. H01–H05 are blank worksheets, not enrolled people. M15 remains **hold for evidence**.

## Before inviting anyone

- [ ] Owner has confirmed the named operator and backup contact, supported hours, feedback access and escalation process in separate private records.
- [ ] Observation, timing, follow-up, withdrawal and deletion terms are explained and agreed with each person being observed.
- [ ] The separate preview and its exact build have passed household access checks. No live financial data or real bank credentials are used.
- [ ] Existing credential-replacement and backup/recovery prerequisites in [pilot operations](pilot-operations.md#before-anyone-is-invited) and [the guide](m11-household-observation.md#enrollment-checklist) are confirmed.
- [ ] These files are stored with restricted operator access. Git ignoring is not filesystem access control. Review Windows folder permissions before entering observations; no access-control claim is made by packet creation.

## Run the first session

1. Assign the next original code only after actual consent. Use [H01](H01.md) first, followed by H02–H05. Keep the contact mapping elsewhere; never put names, emails, account details or credentials here.
2. Follow [the facilitator guide](m11-household-observation.md) with [the synthetic statement](pilot-statement.csv). Do not show the answer column during a task. A rehearsal does not count as household evidence.
3. Record incomplete tasks and assistance honestly. Leave unobserved measurements blank. Optional M12/M13 exercises may be separate sessions; avoid bias from fatigue or prompting.
4. Add actual enrolled households to phase-evidence.json; change kind to observed only for real consenting observations. Keep original cohort counts consistent. Update asOf and the cost month together. Never prefill five successful results.
5. Collect voluntary return observations in days 21–27 and finalize at day 28 or later. The phase report prints calendar dates per household; it sends no reminders. Unknown or withdrawn outcomes remain unknown, without replacement households.
6. From the repository, run: npm run phase:decision -- "${join(output,"phase-evidence.json")}". Keep dated copies of the input/report; the report includes its evidence hash. Do not overwrite observations with the empty template.

## Operating evidence to collect

Keep invoice references and any identifying incident details in separate restricted records. Use anonymous totals in phase-evidence.json.

| Review month | Provider | Hosting | Storage | Notifications | Support minutes | Active original households |
| --- | --- | --- | --- | --- | --- | --- |
| ${asOf.slice(0,7)} | unknown | unknown | unknown | unknown | unknown | 0 enrolled |

| Support date | Household code | Category (onboarding / blocked task / incident / other) | Minutes |
| --- | --- | --- | --- |
| | | | |

Record the owner's delivery-cost and support-time limits before reading results. Separate interest, stated willingness and actual payment. Do not enter zero to clear an unknown gate. No prices, paid launch, wider recruitment or bank activation are approved by this packet.

## Files

- H01.md through H05.md: blank observation sheets; keep notes anonymous and restricted.
- phase-evidence.json: strict M15 input with all missing evidence null.
- phase-report.json: initial hold-for-evidence result; regenerate after observations.
- m11-household-observation.md and pilot-operations.md: facilitator and operating instructions.
- pilot-statement.csv: made-up import exercise only.

The source runbooks remain canonical; these are dated working copies. Physical phones, actual independent recovery and real participant measurements remain outstanding. No results are implied by preparing materials.
`);
  console.log(JSON.stringify({directory:output,startHere:join(output,"START-HERE.md"),observedHouseholds:0,decision:report.decision,productionChanges:false}));
}catch{
  console.error("Pilot preparation failed. Use a valid YYYY-MM-DD date and the empty committed template; check local directory access. Existing packets were not overwritten.");
  process.exitCode=1;
}
