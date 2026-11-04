import { z } from "zod";
export const pilotTasks=["setup","capture","importReview","reconciliation","forecast","weeklyReview"] as const;
const count=z.int().nonnegative();
const duration=z.number().finite().nonnegative();
const task=z.object({attempted:count,unassisted:count,assisted:count}).strict()
  .refine(t=>t.unassisted+t.assisted<=t.attempted,"Completions cannot exceed attempts.");
const measurements=z.object({LCP:z.array(duration),INP:z.array(duration),CLS:z.array(duration)}).strict();
export const evidenceSchema=z.object({
  month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),currency:z.string().regex(/^[A-Z]{3}$/),
  activeHouseholds:count,pilotHouseholds:count,tasks:z.record(z.enum(pilotTasks),task),
  firstFiveSetups:z.array(z.enum(["unassisted","assisted","incomplete"])).max(5),
  familiarCaptureSeconds:z.array(duration),weekFour:z.object({eligible:count,returned:count}).strict(),
  costs:z.object({provider:duration.nullable(),hosting:duration.nullable(),storage:duration.nullable(),notifications:duration.nullable()}).strict(),
  supportMinutes:duration.nullable(),unresolvedCritical:count.nullable(),
  vitals:z.object({desktop:measurements,mobile:measurements}).strict()
}).strict().refine(e=>e.weekFour.returned<=e.weekFour.eligible && e.weekFour.eligible<=e.pilotHouseholds &&
  e.firstFiveSetups.length<=e.tasks.setup.attempted && e.firstFiveSetups.filter(outcome=>outcome==="unassisted").length<=e.tasks.setup.unassisted &&
  e.firstFiveSetups.filter(outcome=>outcome==="assisted").length<=e.tasks.setup.assisted &&
  e.firstFiveSetups.filter(outcome=>outcome==="incomplete").length<=e.tasks.setup.attempted-e.tasks.setup.assisted-e.tasks.setup.unassisted &&
  pilotTasks.every(key=>e.tasks[key].attempted<=e.pilotHouseholds),"Counts must refer to distinct households in the stated cohort.");
export function pilotReport(input:unknown) {
  const e=evidenceSchema.parse(input);
  const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null;};
  const percentile=(xs:number[])=>xs.length?[...xs].sort((x,y)=>x-y)[Math.ceil(xs.length*0.75)-1]:null;
  const values=Object.values(e.costs);
  const total=values.every(v=>v!==null)?values.reduce<number>((sum,v)=>sum+(v??0),0):null;
  return {month:e.month,currency:e.currency,activeHouseholds:e.activeHouseholds,pilotHouseholds:e.pilotHouseholds,
    tasks:Object.fromEntries(pilotTasks.map(key=>[key,{...e.tasks[key],incomplete:e.tasks[key].attempted-e.tasks[key].unassisted-e.tasks[key].assisted}])),
    setupTarget:e.firstFiveSetups.length<5?"insufficient observations":e.firstFiveSetups.filter(x=>x==="unassisted").length>=4?"met":"missed",
    familiarCapture:{samples:e.familiarCaptureSeconds.length,medianSeconds:median(e.familiarCaptureSeconds)},
    weekFour:{...e.weekFour,retention:e.weekFour.eligible?e.weekFour.returned/e.weekFour.eligible:null},
    costs:e.costs,costPerActiveHousehold:total!==null&&e.activeHouseholds?total/e.activeHouseholds:null,
    supportMinutesPerActiveHousehold:e.supportMinutes!==null&&e.activeHouseholds?e.supportMinutes/e.activeHouseholds:null,
    unresolvedCritical:e.unresolvedCritical,
    vitals:Object.fromEntries(Object.entries(e.vitals).map(([device,metrics])=>[device,Object.fromEntries(Object.entries(metrics).map(([name,values])=>[name,{samples:values.length,p75:percentile(values)}]))]))};
}
