import { describe, expect, it } from "vitest";
import empty from "../../../docs/phase-evidence.empty.json";
import { phaseDecision, phaseEvidenceSchema, type PhaseEvidence } from "../phase-decision";

function observed():PhaseEvidence {
  const e=phaseEvidenceSchema.parse(structuredClone(empty));
  e.kind="observed";
  e.households=(["H01","H02","H03","H04","H05"] as const).map((code,i)=>({
    code,consented:true,enrolledOn:"2026-10-01",returned:i<3,voluntaryReview:i<3,
    purchaseExplanation:i<4?"unassisted_correct":"assisted_correct",returnReason:i<3?"shared_review":null,
    stopReason:i<3?null:"manual_import",interested:true,willingMonthly:"10",paidMonthly:"0",
  }));
  Object.assign(e.metrics,{activeHouseholds:3,pilotHouseholds:5,weekFour:{eligible:5,returned:3},
    firstFiveSetups:["unassisted","unassisted","unassisted","unassisted","incomplete"],
    costs:{provider:0,hosting:12,storage:2,notifications:2},supportMinutes:30,unresolvedCritical:0,
    vitals:{mobile:{LCP:[1000],INP:[100],CLS:[0.01]},desktop:{LCP:[1000],INP:[100],CLS:[0.01]}}});
  e.metrics.tasks.setup={attempted:5,unassisted:4,assisted:0};
  e.readiness.web=true;e.readiness.independentRecovery=true;e.readiness.vitalsSource="participant";
  e.limits={supportHourlyRate:"20",maxCostPerActive:"10",maxSupportMinutesPerActive:10};
  return e;
}

describe("phase decision evidence",()=>{
  it("keeps missing evidence unknown, without treating missing costs as zero",()=>{
    const r=phaseDecision(empty);
    expect(r.decision).toBe("hold_for_evidence");
    expect(r.economics.costPerActive).toBeNull();
    expect(r.m13.accepted).toBe(false);
    expect(r.bank.enabled).toBe(false);
    expect(r.gates.every(g=>g.result==="unknown")).toBe(true);
  });
  it("limits even a passing observed cohort to owner review and separates payment from interest",()=>{
    const r=phaseDecision(observed());
    expect(r.decision).toBe("ready_for_owner_review");
    expect(r.ownerApprovalRequired).toBe(true);
    expect(r.productionChanges).toBe(false);
    expect(r.economics).toMatchObject({invoiceCosts:"16.00",supportCost:"10.00",deliveryCost:"26.00",costPerActive:"8.67",
      interested:5,willingToPay:5,paying:0,actualRevenue:"0.00"});
    expect(r.bank.decision).toBe("keep_disabled");
  });
  it("never substitutes a synthetic rehearsal or lab timings for participant evidence",()=>{
    const e=observed();e.kind="rehearsal";
    expect(phaseDecision(e).decision).toBe("hold_for_evidence");
    expect(phaseDecision(e).m13.accepted).toBe(false);
    e.kind="observed";e.readiness.vitalsSource="lab";
    expect(phaseDecision(e).gates.filter(g=>g.name.endsWith("LCP")).every(g=>g.result==="unknown")).toBe(true);
    expect(phaseDecision(e).decision).toBe("hold_for_evidence");
  });
  it("retains original denominators and rejects premature, duplicate or inconsistent observations",()=>{
    for(const change of [
      (e:PhaseEvidence)=>{e.households[4].code="H01";},
      (e:PhaseEvidence)=>{e.households[4].enrolledOn="2026-11-01";e.metrics.weekFour.eligible=4;},
      (e:PhaseEvidence)=>{e.households[4].enrolledOn="2026-12-01";},
      (e:PhaseEvidence)=>{e.metrics.weekFour.returned=4;},
      (e:PhaseEvidence)=>{e.metrics.activeHouseholds=6;},
      (e:PhaseEvidence)=>{e.households[4].voluntaryReview=true;},
      (e:PhaseEvidence)=>{e.metrics.costs.hosting=0.001;},
      (e:PhaseEvidence)=>{e.metrics.month="2026-10";},
    ]){const e=observed();change(e);expect(phaseEvidenceSchema.safeParse(e).success).toBe(false);}
    expect(phaseEvidenceSchema.safeParse({...observed(),email:"do-not-collect@example.invalid"}).success).toBe(false);
  });
  it("does not count an ordinary return as a voluntary review, nor assisted explanation as unassisted",()=>{
    const e=observed();e.households[2].voluntaryReview=false;
    expect(phaseDecision(e).decision).toBe("fix_before_expansion");
    e.households[2].voluntaryReview=null;
    expect(phaseDecision(e).decision).toBe("hold_for_evidence");
    e.households[2].voluntaryReview=true;e.households[3].purchaseExplanation="assisted_correct";
    expect(phaseDecision(e).m13.accepted).toBe(false);
    expect(phaseDecision(e).decision).toBe("fix_before_expansion");
  });
  it("blocks unresolved incidents, failed release checks and costs exceeding owner limits",()=>{
    for(const change of [
      (e:PhaseEvidence)=>{e.metrics.unresolvedCritical=1;},
      (e:PhaseEvidence)=>{e.readiness.web=false;},
      (e:PhaseEvidence)=>{e.limits.maxCostPerActive="8.66";},
      (e:PhaseEvidence)=>{e.metrics.supportMinutes=31;},
      (e:PhaseEvidence)=>{e.metrics.vitals.mobile.LCP=[1000,2000,2600,2800];},
    ]){const e=observed();change(e);expect(phaseDecision(e).decision).toBe("fix_before_expansion");}
    const e=observed();e.metrics.costs.hosting=null;
    expect(phaseDecision(e).economics.deliveryCost).toBeNull();
    expect(phaseDecision(e).decision).toBe("hold_for_evidence");
  });
  it("keeps platforms independent and unknown outcomes unknown",()=>{
    const e=observed();e.platforms.push("android");
    expect(phaseDecision(e).decision).toBe("hold_for_evidence");
    e.readiness.android=true;
    expect(phaseDecision(e).decision).toBe("ready_for_owner_review");
    e.households[4].stopReason=null;
    expect(phaseDecision(e).decision).toBe("hold_for_evidence");
    e.households[4].paidMonthly=null;
    expect(phaseDecision(e).economics.actualRevenue).toBeNull();
  });
  it("includes acquisition labor, keeps its denominator separate and never divides by zero",()=>{
    const e=observed();e.recruitment={channel:"referral",invitations:20,activations:8,eligibleWeekFour:6,returnedWeekFour:3,operatorHours:2,cashSpend:"10"};
    expect(phaseDecision(e).recruitment).toMatchObject({cost:"50.00",costPerActivation:"6.25",costPerWeekFourReturn:"16.67"});
    e.recruitment.returnedWeekFour=0;
    expect(phaseDecision(e).recruitment?.costPerWeekFourReturn).toBeNull();
    e.recruitment.activations=21;
    expect(phaseEvidenceSchema.safeParse(e).success).toBe(false);
  });
  it("can recommend observation-only owner review but never enables banks or modifies the ledger",()=>{
    const e=bankReady();
    expect(phaseDecision(e).bank).toMatchObject({decision:"ready_for_observation_owner_review",enabled:false,blockers:[]});
    for(const change of [
      (x:PhaseEvidence)=>{x.bank.ownerDecision="defer";},
      (x:PhaseEvidence)=>{x.bank.coverage.pop();},
      (x:PhaseEvidence)=>{x.bank.intendedAccounts.push({institution:"TD",accountType:"credit_card"});},
      (x:PhaseEvidence)=>{x.bank.coverage[0].verifiedOn="2026-09-01";},
      (x:PhaseEvidence)=>{x.bank.quoteVerifiedOn="2026-09-01";},
      (x:PhaseEvidence)=>{x.bank.quoteCurrency="USD";},
      (x:PhaseEvidence)=>{x.bank.spendCapMonthly="9.99";},
      (x:PhaseEvidence)=>{x.bank.productionAccess=null;},
      (x:PhaseEvidence)=>{x.bank.consentDeletionIncidentReviewed=false;},
      (x:PhaseEvidence)=>{x.bank.observationRehearsalPassed=false;},
      (x:PhaseEvidence)=>{x.households[4].stopReason="privacy";},
    ]){const x=bankReady();change(x);expect(phaseDecision(x).bank.decision).toBe("keep_disabled");expect(phaseDecision(x).bank.enabled).toBe(false);}
  });
});
function bankReady():PhaseEvidence{
  const e=observed();
  e.bank={ownerDecision:"evaluate_observation_only",intendedAccounts:[{institution:"RBC",accountType:"chequing"},{institution:"TD",accountType:"chequing"}],coverage:[
    {institution:"RBC",country:"CA",product:"transactions",accountType:"chequing",verifiedOn:"2026-11-05"},
    {institution:"TD",country:"CA",product:"transactions",accountType:"chequing",verifiedOn:"2026-11-05"},
  ],quoteMonthly:"10",quoteCurrency:"CAD",quoteVerifiedOn:"2026-11-05",spendCapMonthly:"15",productionAccess:true,consentDeletionIncidentReviewed:true,observationRehearsalPassed:true};
  return e;
}
