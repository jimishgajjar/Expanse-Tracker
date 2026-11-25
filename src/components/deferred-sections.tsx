"use client";

import { type ComponentProps } from "react";
import dynamic from "next/dynamic";
import { ManagerPage } from "./manager-panel";
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

/** Savings goals, shared expenses and members each load their data, then render as a page. */
export function DeferredToolPage({tool, workspace, currentEmail, workspaceName, isOwner, revision}: {tool:"goals"|"split"|"members";revision:unknown;workspace:string;currentEmail:string;workspaceName:string;isOwner:boolean}) {
  const {data,error,retry} = useRemoteData<ToolsData>(`/api/workspace-section?section=tools&workspace=${encodeURIComponent(workspace)}`, revision);
  if (!data) return <LoadingSection error={error} retry={retry} />;
  const trigger = <span />;
  return <ManagerPage>
    {tool === "goals" ? <GoalsManager goals={data.goals} trigger={trigger} />
      : tool === "split" ? <SplitManager data={data.split} trigger={trigger} />
      : <MembersManager members={data.members} invites={data.invites} currentEmail={currentEmail} workspaceName={workspaceName} isOwner={isOwner} trigger={trigger} />}
  </ManagerPage>;
}

export function DeferredPlanning(props: Omit<ComponentProps<typeof PlanningTab>,"goals"|"split"> & {workspace:string}) {
  const {data,error,retry} = useRemoteData<ToolsData>(`/api/workspace-section?section=tools&workspace=${encodeURIComponent(props.workspace)}`, props.budgets);
  return data ? <PlanningTab {...props} goals={data.goals} split={data.split} /> : <LoadingSection error={error} retry={retry} />;
}

export function DeferredAnalytics(props: Omit<ComponentProps<typeof AnalyticsTab>,"analytics"|"netWorth"|"transactions"> & {workspace:string;anchor:string}) {
  const {data,error,retry} = useRemoteData<{analytics:AnalyticsData;netWorth:NetWorthPoint[];transactions:TransactionDTO[]}>(`/api/workspace-section?section=analytics&range=${props.rangeType}&date=${props.anchor}&workspace=${encodeURIComponent(props.workspace)}`, props.budgets);
  return data ? <AnalyticsTab {...props} {...data} /> : <LoadingSection error={error} retry={retry} />;
}
