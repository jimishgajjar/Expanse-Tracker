"use client";

import { useState, type ComponentProps } from "react";
import dynamic from "next/dynamic";
import { Target, Handshake, Users } from "lucide-react";
import { useRemoteData } from "./use-remote-data";
import { Button } from "./ui/button";
import type { GoalDTO, SplitData, MemberDTO, TransactionDTO, NetWorthPoint } from "@/lib/queries";
import type { AnalyticsData } from "@/lib/analytics";
const GoalsManager = dynamic(() => import("./goals-manager").then(m => m.GoalsManager));
const SplitManager = dynamic(() => import("./split-manager").then(m => m.SplitManager));
const MembersManager = dynamic(() => import("./members-manager").then(m => m.MembersManager));
const PlanningTab = dynamic(() => import("./planning-tab").then(m => m.PlanningTab));
const AnalyticsTab = dynamic(() => import("./analytics-tab").then(m => m.AnalyticsTab));
type ToolsData = {goals: GoalDTO[]; split: SplitData; members: MemberDTO[]; invites: string[]};

function LoadingSection({error, retry}: {error?: string; retry: () => void}) {
  return <div className="rounded-lg border p-4" role={error ? "alert" : "status"}><p className="text-sm text-muted-foreground">{error ?? "Loading this section…"}</p>{error && <Button variant="outline" onClick={retry}>Try again</Button>}</div>;
}

export function DeferredTools({workspace, currentEmail, workspaceName, isOwner, canEdit, revision}: {revision:unknown;workspace:string;currentEmail:string;workspaceName:string;isOwner:boolean;canEdit:boolean}) {
  const [selected,setSelected] = useState<"goals"|"split"|"members"|null>(null);
  const {data,error,retry} = useRemoteData<ToolsData>(selected ? `/api/workspace-section?section=tools&workspace=${encodeURIComponent(workspace)}` : null, revision);
  const options = [{id:"goals",label:"Savings goals",icon:Target},{id:"split",label:"Shared expenses",icon:Handshake},{id:"members",label:"Members & sharing",icon:Users}] as const;
  return <>{options.filter(o => canEdit || o.id === "members").map(o => {
    const trigger = <button type="button" className="nav-item" onClick={() => setSelected(o.id)}><o.icon className="size-[18px]" /><span>{o.label}</span></button>;
    if (!data || selected !== o.id) return <div key={o.id}>{trigger}</div>;
    if(o.id === "goals") return <GoalsManager key={o.id} defaultOpen goals={data.goals} trigger={trigger} />;
    if(o.id === "split") return <SplitManager key={o.id} defaultOpen data={data.split} trigger={trigger} />;
    return <MembersManager key={o.id} defaultOpen members={data.members} invites={data.invites} currentEmail={currentEmail} workspaceName={workspaceName} isOwner={isOwner} trigger={trigger} />;
  })}{selected && !data && <LoadingSection error={error} retry={retry} />}</>;
}

export function DeferredPlanning(props: Omit<ComponentProps<typeof PlanningTab>,"goals"|"split"> & {workspace:string}) {
  const {data,error,retry} = useRemoteData<ToolsData>(`/api/workspace-section?section=tools&workspace=${encodeURIComponent(props.workspace)}`, props.budgets);
  return data ? <PlanningTab {...props} goals={data.goals} split={data.split} /> : <LoadingSection error={error} retry={retry} />;
}

export function DeferredAnalytics(props: Omit<ComponentProps<typeof AnalyticsTab>,"analytics"|"netWorth"|"transactions"> & {workspace:string;anchor:string}) {
  const {data,error,retry} = useRemoteData<{analytics:AnalyticsData;netWorth:NetWorthPoint[];transactions:TransactionDTO[]}>(`/api/workspace-section?section=analytics&range=${props.rangeType}&date=${props.anchor}&workspace=${encodeURIComponent(props.workspace)}`, props.budgets);
  return data ? <AnalyticsTab {...props} {...data} /> : <LoadingSection error={error} retry={retry} />;
}
