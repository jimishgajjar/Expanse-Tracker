import { describe, expect, it } from "vitest";
import type { GoalDTO, RecurringDTO, SplitData, SplitDTO } from "../queries";
import { weeklyHouseholdCheckIn } from "../weekly-household";

const today = "2026-12-29";
const household: SplitData = {
  reimbursementWorkspace: "home", meId: "a", otherMembers: [{id:"b",name:"Bea"},{id:"c",name:"Cal"}],
  splits: [], balances: [],
};
function iou(id: string, creditorId: string, debtorId: string, amount: number): SplitDTO {
  return {id, creditorId, debtorId, amount, note: ""};
}
function bill(id: string, nextDate: string, extra: Partial<RecurringDTO> = {}): RecurringDTO {
  return {id, nextDate, note:id, type:"expense", amount:25, frequency:"weekly", accountId:null, categoryId:null,
    endDate:null, maxOccurrences:null, occurrenceCount:0, alertsEnabled:false, remindDaysBefore:0,
    commitmentType:"bill", autoPost:true, totalAmount:null, priceHistory:[], ...extra};
}
function goal(id: string, deadline: string | null, savedAmount = 0): GoalDTO {
  return {id, name:id, deadline, savedAmount, targetAmount:100, color:"#000000"};
}
describe("weekly household check-in", () => {
  it("nets each pair to the cent, keeps other pairs separate and puts your balances first", () => {
    const splits = [iou("1","b","a",1.11), iou("2","a","b",0.1), iou("3","c","b",91),
      iou("4","a","c",0.3), iou("5","c","a",0.1), iou("6","c","a",0.2)];
    const review = weeklyHouseholdCheckIn("home",today,{...household,splits},[],[])!;
    expect(review.reimbursements.map(row => [row.label,row.amount])).toEqual([["You owe Bea",1.01],["Bea owes Cal",91]]);
    expect(weeklyHouseholdCheckIn("home",today,{...household,meId:"b",splits,
      otherMembers:[{id:"a",name:"Ari"},{id:"c",name:"Cal"}]},[],[])!.reimbursements.map(r=>r.label))
      .toEqual(["You owe Cal","Ari owes you"]);
  });
  it("includes both ends of seven calendar days across the year and separates past schedule dates", () => {
    const schedules = [bill("estimated","2027-01-04",{autoPost:false,endDate:"2027-01-04"}), bill("today",today),
      bill("next week","2027-01-05"),bill("old","2026-12-28"),bill("income",today,{type:"income"}),
      bill("finished",today,{maxOccurrences:3,occurrenceCount:3}),bill("past end","2027-01-02",{endDate:"2027-01-01"}),
      bill("expired","2026-12-20",{endDate:"2026-12-25"})];
    const review = weeklyHouseholdCheckIn("home",today,household,schedules,[])!;
    expect(review.through).toBe("2027-01-04");
    expect(review.bills.map(b=>[b.id,b.autoPost])).toEqual([["today",true],["estimated",false]]);
    expect(review.pastSchedules).toBe(1);
  });
  it("prioritizes the earliest outstanding goals and uses confirmed progress even with an unreviewed opening", () => {
    const goals = [goal("no deadline",null),goal("complete",null,100),goal("upcoming","2027-01-02"),
      {...goal("overdue","2026-12-20",12),openingProgress:110,openingReviewed:false},goal("above target",today,120)];
    const review = weeklyHouseholdCheckIn("home",today,household,[],goals)!;
    expect(review.goals.map(g=>[g.id,g.savedAmount])).toEqual([["overdue",12],["upcoming",0],["no deadline",0]]);
    expect(review.completedGoals).toBe(2);
  });
  it("shows an empty household and hides the review without a matching household capability", () => {
    expect(weeklyHouseholdCheckIn("home",today,household,[],[])).toMatchObject({reimbursements:[],bills:[],goals:[],completedGoals:0});
    expect(weeklyHouseholdCheckIn("other",today,household,[],[])).toBeNull();
    expect(weeklyHouseholdCheckIn("private",today,{...household,reimbursementWorkspace:undefined},[],[])).toBeNull();
  });
});
