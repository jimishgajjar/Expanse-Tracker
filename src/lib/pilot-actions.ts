"use server";

import { revalidatePath } from "next/cache";
import { getActiveWorkspaceId } from "./workspace";
import { getSession } from "./session";
import { pilotDatabase } from "./pilot-release";
import { PilotProblem,recordFeedback,reviewOpening,savePreferences,type Opening } from "./pilot-setup";

export type PilotResult={message:string;ok:boolean;opening?:Opening};
export async function pilotAction(workspace:string,_previous:PilotResult|null,form:FormData):Promise<PilotResult> {
  const [session,active,db]=await Promise.all([getSession(),getActiveWorkspaceId(),pilotDatabase()]);
  if (!db || !session || active!==workspace) return {ok:false,message:"Reopen the intended household and try again."};
  const s={workspace,actor:session.user.id};
  const value=(key:string)=>String(form.get(key)??"").trim();
  try {
    switch (value("action")) {
      case "preferences":
        await savePreferences(db,s,value("currency"),value("timezone"),form.has("bills"),form.has("invite"));
        break;
      case "preview":
        return {ok:true,message:"History checked.",opening:await reviewOpening(db,s,value("account"),value("date"))};
      case "confirm":
        await reviewOpening(db,s,value("account"),value("date"),value("statement"));
        break;
      case "feedback": {
        const receipt=await recordFeedback(db,s,value("severity"),value("message"));
        revalidatePath("/feedback");
        return {ok:true,message:"Report received. Reference "+receipt};
      }
      default:throw new PilotProblem("Reopen the form and choose an action.");
    }
    revalidatePath("/setup");
    revalidatePath("/");
    return {ok:true,message:"Household setup saved."};
  } catch (error) {
    return {ok:false,message:error instanceof PilotProblem?error.message:"Could not confirm this change. Reload and check the saved state before retrying."};
  }
}
