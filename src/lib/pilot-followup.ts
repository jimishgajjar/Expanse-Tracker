import { statementDate } from "./statement-review";

const DAY=86400000;
/** Calendar dates, not local timestamps: daylight saving must not shift a household's window. */
export function pilotFollowup(enrolledOn:string,asOf:string){
  statementDate.parse(enrolledOn);statementDate.parse(asOf);
  if(enrolledOn>asOf)throw Error("Enrollment cannot be after the review date.");
  const started=Date.parse(enrolledOn+"T00:00:00Z");
  const elapsed=(Date.parse(asOf+"T00:00:00Z")-started)/DAY;
  const date=(days:number)=>{
    const value=new Date(started+days*DAY).toISOString().slice(0,10);
    return statementDate.parse(value);
  };
  return {windowStartsOn:date(21),windowEndsOn:date(27),readoutOn:date(28),
    state:elapsed<21?"waiting" as const:elapsed<28?"observing" as const:"ready" as const,
    daysUntilReadout:Math.max(0,28-elapsed)};
}
