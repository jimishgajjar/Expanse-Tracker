import { z } from "zod";
import { evidenceSchema, pilotReport } from "./pilot-scorecard";
import { statementDate, moneyCents, decimalMoney } from "./statement-review";
import { pilotFollowup } from "./pilot-followup";

const count=z.int().min(0).max(1000000);
const duration=z.number().min(0).max(1000000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001,"Use at most two decimals.");
const money=z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const known=z.boolean().nullable();
const household=z.object({
  code:z.enum(["H01","H02","H03","H04","H05"]),consented:z.literal(true),enrolledOn:statementDate,
  returned:known,voluntaryReview:known,
  purchaseExplanation:z.enum(["unassisted_correct","assisted_correct","incorrect","unfinished"]).nullable(),
  returnReason:z.enum(["shared_review","spending_decision","bill_tracking","habit","other"]).nullable(),
  stopReason:z.enum(["manual_import","setup","unexplained_balance","privacy","cost","no_value","other"]).nullable(),
  interested:known,willingMonthly:money.nullable(),paidMonthly:money.nullable(),
}).strict();
const eligible=(started:string,asOf:string)=>Date.parse(asOf+"T00:00:00Z")-Date.parse(started+"T00:00:00Z")>=28*86400000;

/** Anonymous operator evidence, never a feature flag or permission to spend money. */
export const phaseEvidenceSchema=z.object({
  version:z.literal(1),kind:z.enum(["uncollected","rehearsal","observed"]),asOf:statementDate,
  metrics:evidenceSchema,households:z.array(household).max(5),
  platforms:z.array(z.enum(["web","android","ios"])).min(1).max(3),
  readiness:z.object({web:known,android:known,ios:known,independentRecovery:known,vitalsSource:z.enum(["participant","lab","unmeasured"])}).strict(),
  limits:z.object({supportHourlyRate:money.nullable(),maxCostPerActive:money.nullable(),maxSupportMinutesPerActive:duration.nullable()}).strict(),
  recruitment:z.object({channel:z.enum(["referral","community","organic","paid","other"]),invitations:count,activations:count,
    eligibleWeekFour:count,returnedWeekFour:count,operatorHours:duration.nullable(),cashSpend:money.nullable()}).strict().nullable(),
  bank:z.object({ownerDecision:z.enum(["defer","evaluate_observation_only"]),
    intendedAccounts:z.array(z.object({institution:z.enum(["RBC","TD"]),accountType:z.enum(["chequing","savings","credit_card"])}).strict()).max(6),
    coverage:z.array(z.object({institution:z.enum(["RBC","TD"]),country:z.literal("CA"),product:z.literal("transactions"),accountType:z.enum(["chequing","savings","credit_card"]),verifiedOn:statementDate}).strict()).max(6),
    quoteMonthly:money.nullable(),quoteCurrency:z.string().regex(/^[A-Z]{3}$/).nullable(),quoteVerifiedOn:statementDate.nullable(),
    spendCapMonthly:money.nullable(),productionAccess:known,consentDeletionIncidentReviewed:known,observationRehearsalPassed:known,
  }).strict(),
}).strict().superRefine((e,ctx)=>{
  const issue=(message:string)=>ctx.addIssue({code:"custom",message});
  const h=e.households,ready=h.filter(x=>eligible(x.enrolledOn,e.asOf));
  if(new Set(h.map(x=>x.code)).size!==h.length)issue("Household codes must be unique.");
  if(new Set(e.platforms).size!==e.platforms.length)issue("Platforms must be unique.");
  if(e.metrics.pilotHouseholds!==h.length||e.metrics.activeHouseholds>h.length)issue("Counts must describe the original cohort.");
  if(e.metrics.weekFour.eligible!==ready.length||e.metrics.weekFour.returned!==ready.filter(x=>x.returned===true).length)issue("Week-four counts must match dated original-household observations.");
  if(e.metrics.month!==e.asOf.slice(0,7))issue("Cost month must match the review month.");
  for(const x of h){
    if(x.enrolledOn>e.asOf)issue("Enrollment cannot be after the review date.");
    if(!eligible(x.enrolledOn,e.asOf)&&(x.returned!==null||x.voluntaryReview!==null||x.returnReason!==null||x.stopReason!==null))issue("Do not record week-four outcomes before 28 days.");
    if(x.voluntaryReview===true&&x.returned!==true)issue("A completed voluntary review requires a returned household.");
    if(x.returnReason!==null&&x.returned!==true)issue("Return reasons require a return.");
    if(x.stopReason!==null&&x.returned!==false)issue("Stop reasons require a non-return.");
  }
  for(const v of Object.values(e.metrics.costs))if(v!==null&&!money.safeParse(String(v)).success)issue("Invoice costs must be nonnegative amounts with at most two decimals.");
  if(e.metrics.supportMinutes!==null&&!duration.safeParse(e.metrics.supportMinutes).success)issue("Support time must be measured minutes with at most two decimals.");
  const r=e.recruitment;
  if(r&&(r.activations>r.invitations||r.eligibleWeekFour>r.activations||r.returnedWeekFour>r.eligibleWeekFour))issue("Recruitment counts must retain their own eligible denominator.");
  if(new Set(e.bank.coverage.map(c=>c.institution+":"+c.accountType)).size!==e.bank.coverage.length)issue("Coverage rows must be unique institution/account-type pairs.");
  if(new Set(e.bank.intendedAccounts.map(c=>c.institution+":"+c.accountType)).size!==e.bank.intendedAccounts.length)issue("Intended account pairs must be unique.");
  if(e.bank.coverage.some(c=>c.verifiedOn>e.asOf))issue("Coverage verification cannot be future-dated.");
  if(e.bank.quoteVerifiedOn!==null&&e.bank.quoteVerifiedOn>e.asOf)issue("Quote verification cannot be future-dated.");
  if(e.kind==="uncollected"&&(h.length||e.metrics.activeHouseholds))issue("Uncollected evidence cannot contain participant results.");
});
export type PhaseEvidence=z.infer<typeof phaseEvidenceSchema>;
type Gate={name:string;result:"pass"|"fail"|"unknown";detail:string};
const roundDivide=(n:bigint,d:bigint)=>(n+d/BigInt(2))/d;

export function phaseDecision(input:unknown){
  const e=phaseEvidenceSchema.parse(input),report=pilotReport(e.metrics),gates:Gate[]=[];
  const add=(name:string,ok:boolean|null,detail:string)=>gates.push({name,result:ok===null?"unknown":ok?"pass":"fail",detail});
  const observed=e.kind==="observed",five=e.households.length===5;
  const mature=e.households.filter(h=>eligible(h.enrolledOn,e.asOf));
  const explanations=e.households.filter(h=>h.purchaseExplanation==="unassisted_correct").length;
  const reviews=mature.filter(h=>h.returned&&h.voluntaryReview).length;
  add("Observed cohort",observed&&five?true:null,`${e.kind}; ${e.households.length}/5 original households. Rehearsals are not participant evidence.`);
  add("Four-week follow-up",observed&&five&&mature.length===5?true:null,`${mature.length}/5 eligible after 28 days.`);
  add("Setup",observed&&report.setupTarget!=="insufficient observations"?report.setupTarget==="met":null,"At least 4 of the original 5 finish setup unassisted.");
  add("M13 comprehension",observed&&five?(explanations>=4?true:e.households.some(h=>h.purchaseExplanation===null)?null:false):null,`${explanations}/5 explain the purchase result correctly without assistance.`);
  add("Voluntary weekly reviews",observed&&mature.length===5?(reviews>=3?true:mature.some(h=>h.voluntaryReview===null)?null:false):null,`${reviews}/5 returned and completed a review voluntarily at week four.`);
  add("Reasons for returning or stopping",observed&&five&&mature.length===5&&mature.every(h=>h.returned===true?h.returnReason!==null:h.returned===false&&h.stopReason!==null)?true:null,"Record each original household's own reason; unknown is not no problem.");
  add("Financial and privacy incidents",e.metrics.unresolvedCritical===null?null:e.metrics.unresolvedCritical===0,`${e.metrics.unresolvedCritical??"Unknown"} unresolved critical incidents.`);
  for(const platform of e.platforms)add(`${platform} acceptance`,e.readiness[platform],"Requires the actual release/device evidence, not bundle export alone.");
  add("Independent recovery",e.readiness.independentRecovery,"A clean replacement environment must recover without the original Windows profile.");
  for(const device of ["mobile","desktop"] as const)for(const [metric,target] of [["LCP",2500],["INP",200],["CLS",0.1]] as const){
    const samples=e.metrics.vitals[device][metric],p75=report.vitals[device][metric].p75;
    add(`${device} ${metric}`,observed&&e.readiness.vitalsSource==="participant"&&p75!==null?p75<=target:null,`${samples.length} samples; p75 ${p75??"unknown"}; target ${target}. Small samples are provisional.`);
  }
  const costs=Object.values(e.metrics.costs),active=e.metrics.activeHouseholds;
  const infra=costs.every(v=>v!==null)?costs.reduce((sum,v)=>sum+moneyCents(String(v)),BigInt(0)):null;
  const rate=e.limits.supportHourlyRate===null?null:moneyCents(e.limits.supportHourlyRate);
  const labor=rate!==null&&e.metrics.supportMinutes!==null?roundDivide(rate*BigInt(Math.round(e.metrics.supportMinutes*100)),BigInt(6000)):null;
  const delivery=infra!==null&&labor!==null?infra+labor:null;
  add("Delivery cost limit",delivery!==null&&active>0&&e.limits.maxCostPerActive!==null?delivery<=moneyCents(e.limits.maxCostPerActive)*BigInt(active):null,"Include invoice costs and measured support at the owner's stated hourly rate. Missing limits remain unknown.");
  add("Support time limit",active>0&&e.metrics.supportMinutes!==null&&e.limits.maxSupportMinutesPerActive!==null?e.metrics.supportMinutes<=e.limits.maxSupportMinutesPerActive*active:null,"Measured minutes per active household must fit the owner's stated limit.");
  const knownPayments=e.households.filter(h=>h.paidMonthly!==null);
  const revenue=knownPayments.reduce((sum,h)=>sum+moneyCents(h.paidMonthly!),BigInt(0));
  const stopCounts=Object.fromEntries(["manual_import","setup","unexplained_balance","privacy","cost","no_value","other"].map(reason=>[reason,mature.filter(h=>h.stopReason===reason).length]));
  const importLeading=stopCounts.manual_import>=2&&stopCounts.manual_import===Math.max(...Object.values(stopCounts));
  const failed=gates.filter(g=>g.result==="fail"),unknown=gates.filter(g=>g.result==="unknown");
  const decision=failed.length?"fix_before_expansion":unknown.length?"hold_for_evidence":"ready_for_owner_review";
  const b=e.bank,bankBlockers:string[]=[];
  if(decision!=="ready_for_owner_review")bankBlockers.push("Close the cohort, reliability and delivery-cost gates first.");
  if(!observed||!importLeading)bankBlockers.push("Repeated manual import is not yet an observed leading reason households stop.");
  if(b.ownerDecision!=="evaluate_observation_only")bankBlockers.push("A new owner decision is required before bank evaluation.");
  for(const bank of ["RBC","TD"])if(!b.intendedAccounts.some(c=>c.institution===bank))bankBlockers.push(`Name the intended ${bank} account types before checking coverage.`);
  for(const wanted of b.intendedAccounts)if(!b.coverage.some(c=>c.institution===wanted.institution&&c.accountType===wanted.accountType))
    bankBlockers.push(`Verify Canadian Transactions support for ${wanted.institution} ${wanted.accountType}.`);
  if(b.coverage.some(c=>Date.parse(e.asOf)-Date.parse(c.verifiedOn)>30*86400000))bankBlockers.push("Refresh coverage evidence older than 30 days; this is a review policy, not a coverage guarantee.");
  if(b.quoteMonthly===null||b.spendCapMonthly===null)bankBlockers.push("Obtain an actual quote and owner-approved spending cap.");
  else if(b.quoteCurrency!==e.metrics.currency)bankBlockers.push("Quote and spending cap must be reviewed in the same reporting currency; no exchange rate is assumed.");
  else if(moneyCents(b.quoteMonthly)>moneyCents(b.spendCapMonthly))bankBlockers.push("Provider quote exceeds the spending cap.");
  if(b.quoteVerifiedOn===null||Date.parse(e.asOf)-Date.parse(b.quoteVerifiedOn)>30*86400000)bankBlockers.push("Obtain or refresh the dated provider quote before an owner decision.");
  if(b.productionAccess!==true)bankBlockers.push("Provider production access is unconfirmed.");
  if(b.consentDeletionIncidentReviewed!==true)bankBlockers.push("Consent, deletion and incident handling need review.");
  if(b.observationRehearsalPassed!==true)bankBlockers.push("Prove disconnect, replay and pending-to-posted handling without ledger mutations.");
  const recruitment=e.recruitment;
  const acquisition=recruitment&&rate!==null&&recruitment.cashSpend!==null&&recruitment.operatorHours!==null?
    moneyCents(recruitment.cashSpend)+roundDivide(rate*BigInt(Math.round(recruitment.operatorHours*100)),BigInt(100)):null;
  return {version:1,asOf:e.asOf,kind:e.kind,decision,ownerApprovalRequired:true,productionChanges:false,gates,
    m13:{correctUnassisted:explanations,denominator:5,accepted:observed&&five&&explanations>=4},
    cohort:{original:e.households.length,eligible:mature.length,voluntaryReviews:reviews,stopReasons:stopCounts,
      followup:e.households.map(h=>({code:h.code,...pilotFollowup(h.enrolledOn,e.asOf),outcome:h.returned===null?"unknown":h.returned?"returned":"did_not_return"}))},
    economics:{currency:e.metrics.currency,activeHouseholds:active,invoiceCosts:infra===null?null:decimalMoney(infra),supportCost:labor===null?null:decimalMoney(labor),
      deliveryCost:delivery===null?null:decimalMoney(delivery),costPerActive:delivery!==null&&active?decimalMoney(roundDivide(delivery,BigInt(active))):null,
      interested:e.households.filter(h=>h.interested===true).length,willingToPay:e.households.filter(h=>h.willingMonthly!==null&&moneyCents(h.willingMonthly)>BigInt(0)).length,
      paying:e.households.filter(h=>h.paidMonthly!==null&&moneyCents(h.paidMonthly)>BigInt(0)).length,paymentObservations:knownPayments.length,
      actualRevenue:five&&knownPayments.length===5?decimalMoney(revenue):null,paidOfferingDecision:"Not established by interest or a five-household pilot."},
    recruitment:recruitment?{...recruitment,cost:acquisition===null?null:decimalMoney(acquisition),
      costPerActivation:acquisition!==null&&recruitment.activations?decimalMoney(roundDivide(acquisition,BigInt(recruitment.activations))):null,
      costPerWeekFourReturn:acquisition!==null&&recruitment.returnedWeekFour?decimalMoney(roundDivide(acquisition,BigInt(recruitment.returnedWeekFour))):null}:null,
    bank:{decision:bankBlockers.length?"keep_disabled":"ready_for_observation_owner_review",enabled:false,blockers:bankBlockers,
      ledgerPolicy:"Observation only, then explicit Match existing / Import / Ignore after reconciliation. Manual file review remains available."},
    next:decision==="ready_for_owner_review"?"Owner may review a small second cohort using one recruitment channel. This is not approval for a broad or paid launch.":"Collect the missing observations or fix failed gates. Keep the original cohort and unknown values; do not substitute synthetic results.",
  };
}
