import { describe, expect, it } from "vitest";
import { pilotFollowup } from "../pilot-followup";
import { phaseDecision, phaseEvidenceSchema } from "../phase-decision";
import empty from "../../../docs/phase-evidence.empty.json";

describe("pilot follow-up calendar",()=>{
  it("observes days 21 through 27 and opens final readout on day 28",()=>{
    expect(pilotFollowup("2026-11-06","2026-11-06")).toEqual({windowStartsOn:"2026-11-27",windowEndsOn:"2026-12-03",readoutOn:"2026-12-04",state:"waiting",daysUntilReadout:28});
    expect(pilotFollowup("2026-11-06","2026-11-26").state).toBe("waiting");
    expect(pilotFollowup("2026-11-06","2026-11-27")).toMatchObject({state:"observing",daysUntilReadout:7});
    expect(pilotFollowup("2026-11-06","2026-12-03")).toMatchObject({state:"observing",daysUntilReadout:1});
    expect(pilotFollowup("2026-11-06","2026-12-04")).toMatchObject({state:"ready",daysUntilReadout:0});
  });
  it("uses calendar days across Toronto clock changes, leap days and year boundaries",()=>{
    expect(pilotFollowup("2026-10-16","2026-11-13").readoutOn).toBe("2026-11-13");
    expect(pilotFollowup("2026-02-14","2026-03-14").readoutOn).toBe("2026-03-14");
    expect(pilotFollowup("2028-02-01","2028-02-29").readoutOn).toBe("2028-02-29");
    expect(pilotFollowup("2026-12-20","2027-01-17").readoutOn).toBe("2027-01-17");
    expect(()=>pilotFollowup("2026-02-30","2026-03-30")).toThrow();
    expect(()=>pilotFollowup("2026-11-07","2026-11-06")).toThrow();
  });
  it("keeps missing outcomes unknown after eligibility and never treats reserved sheets as households",()=>{
    expect(phaseDecision(empty).cohort.followup).toEqual([]);
    const e=phaseEvidenceSchema.parse(structuredClone(empty));
    e.kind="observed";e.metrics.pilotHouseholds=1;
    e.households=[{code:"H01",consented:true,enrolledOn:"2026-10-10",returned:null,voluntaryReview:null,purchaseExplanation:null,returnReason:null,stopReason:null,interested:null,willingMonthly:null,paidMonthly:null}];
    expect(phaseDecision(e).cohort.followup[0]).toMatchObject({state:"observing",outcome:"unknown",readoutOn:"2026-11-07"});
    e.households[0].returned=false;
    expect(phaseEvidenceSchema.safeParse(e).success).toBe(false);
    e.households[0].returned=null;e.asOf="2026-11-07";e.metrics.weekFour.eligible=1;
    expect(phaseDecision(e).cohort.followup[0]).toMatchObject({state:"ready",outcome:"unknown"});
    expect(phaseDecision(e).decision).toBe("hold_for_evidence");
  });
});
