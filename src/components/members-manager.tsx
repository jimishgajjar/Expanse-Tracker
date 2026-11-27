"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, LogOut, Plus, Trash2, UserRound, Users } from "lucide-react";
import { ManagerPanel, PanelCreate } from "./manager-panel";
import { ToolPage, ToolSection } from "./tool-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  inviteMember,
  leaveWorkspace,
  removeInvite,
  removeMember,
  transferOwnership,
} from "@/lib/sharing";
import type { MemberDTO } from "@/lib/queries";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", member: "Can edit", viewer: "View only" };

/** What each level of access allows, in the words the invite form uses. */
function AccessGuide() {
  const rows = [
    { role: "Owner", text: "Everything, including inviting and removing people and handing over ownership." },
    { role: "Can edit", text: "Add, change and delete entries, including ones someone else entered." },
    { role: "View only", text: "See accounts, entries and reports, without changing anything." },
  ];
  return (
    <section aria-labelledby="access-guide" className="rounded-xl border border-border bg-card">
      <h2 id="access-guide" className="border-b border-border px-4 py-3 text-sm font-semibold">What each person can do</h2>
      <dl className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.role} className="px-4 py-3">
            <dt className="text-sm font-medium">{r.role}</dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.text}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">Everyone with access sees this tracker&apos;s accounts and entries.</p>
    </section>
  );
}

export function MembersManager({
  trigger,
  defaultOpen = false,
  members: initialMembers,
  invites: initialInvites,
  currentEmail,
  workspaceName,
  isOwner,
}: {
  trigger: ReactElement;
  defaultOpen?: boolean;
  members: MemberDTO[];
  invites: string[];
  currentEmail: string;
  workspaceName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);

  function onInvited(member: MemberDTO | null, invite: string | null) {
    if (member)
      setMembers((m) =>
        m.some((x) => x.id === member.id) ? m : [...m, member],
      );
    if (invite) setInvites((i) => (i.includes(invite) ? i : [...i, invite]));
    router.refresh();
  }
  function onMemberRemoved(id: string) {
    setMembers((m) => m.filter((x) => x.id !== id));
    router.refresh();
  }
  function onInviteRemoved(email: string) {
    setInvites((i) => i.filter((x) => x !== email));
    router.refresh();
  }
  function onTransferred(userId: string) {
    setMembers((m) =>
      m.map((x) =>
        x.id === userId
          ? { ...x, role: "owner" }
          : x.role === "owner"
            ? { ...x, role: "member" }
            : x,
      ),
    );
    router.refresh();
  }

  return (
    <ManagerPanel
      defaultOpen={defaultOpen}
      trigger={trigger}
      title="Members & sharing"
      icon={Users}
      description={
        isOwner
          ? `Manage access to ${workspaceName}. Each person signs in with their own account.`
          : `You have shared access to ${workspaceName}.`
      }
    >
      <ToolPage
        main={
          <>
            <ToolSection title={`People with access to ${workspaceName} (${members.length})`}>
              {members.map((m) => (
                <MemberRow key={m.id} member={m} isMe={m.email === currentEmail} canManage={isOwner} onRemoved={onMemberRemoved} onTransferred={onTransferred} />
              ))}
            </ToolSection>
            {isOwner && invites.length > 0 && (
              <ToolSection title={`Invited, not joined yet (${invites.length})`}>
                {invites.map((e) => (
                  <InviteRow key={e} email={e} onRemoved={onInviteRemoved} />
                ))}
              </ToolSection>
            )}
          </>
        }
        aside={
          <>
            {isOwner && (
              <PanelCreate title="Invite someone" defaultOpen>
                <InviteForm onInvited={onInvited} />
              </PanelCreate>
            )}
            <AccessGuide />
            {!isOwner && <LeaveButton />}
          </>
        }
      />
    </ManagerPanel>
  );
}

function InviteForm({
  onInvited,
}: {
  onInvited: (member: MemberDTO | null, invite: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    start(async () => {
      const res = await inviteMember({ email, role });
      if (res.ok) {
        toast.success(res.member ? "Member added" : "Invitation saved for this email address");
        setEmail("");
        onInvited(res.member ?? null, res.invite ?? null);
      } else toast.error(res.error);
    });
  }
  return (
    <form onSubmit={add} className="space-y-4">
      <label className="grid gap-1.5 text-xs font-medium">
        Email address
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
      </label>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-xs font-medium">Access</legend>
        <div className="segmented w-full [&>button]:flex-1 [&>button]:justify-center">
          {(["member", "viewer"] as const).map((r) => (
            <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>{ROLE_LABEL[r]}</button>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending || !email.trim()} className="w-full">
        <Plus className="size-4" /> {pending ? "Inviting…" : "Send invite"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">They get access when they sign in with this email. Someone new can use the <a href="/signup" target="_blank" rel="noreferrer" className="text-link">sign-up page</a> first.</p>
    </form>
  );
}

function MemberRow({
  member,
  isMe,
  canManage,
  onRemoved,
  onTransferred,
}: {
  member: MemberDTO;
  isMe: boolean;
  canManage: boolean;
  onRemoved: (id: string) => void;
  onTransferred: (id: string) => void;
}) {
  async function remove() {
    const res = await removeMember(member.id);
    if (res.ok) {
      toast.success("Member removed");
      onRemoved(member.id);
    } else toast.error(res.error);
  }
  async function makeOwner() {
    const res = await transferOwnership(member.id);
    if (res.ok) {
      toast.success(`${member.name || member.email} is now the owner`);
      onTransferred(member.id);
    } else toast.error(res.error);
  }
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-semibold text-brand" aria-hidden>
        {(member.name || member.email).slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">
            {member.name || member.email}
          </span>
          {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
        </div>
        {member.name && (
          <div className="truncate text-xs text-muted-foreground">
            {member.email}
          </div>
        )}
      </div>
      <span className="w-20 shrink-0 text-right text-xs font-medium text-muted-foreground">{ROLE_LABEL[member.role] ?? member.role}</span>
      {isMe ? (
        <span className="w-16 shrink-0" aria-hidden />
      ) : canManage ? (
        <>
          {member.role !== "owner" && (
            <ConfirmDialog
              trigger={
                <Button size="icon-sm" variant="ghost" aria-label="Make owner">
                  <Crown className="size-3.5" />
                </Button>
              }
              title={`Make ${member.email} the owner?`}
              description="They'll get full control of this tracker, and you'll become a regular member. This can't be undone by you."
              confirmLabel="Transfer ownership"
              onConfirm={makeOwner}
            />
          )}
          <ConfirmDialog
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="Remove member">
                <Trash2 className="size-3.5" />
              </Button>
            }
            title={`Remove ${member.email}?`}
            description="They will lose access to this tracker (their own account is untouched)."
            onConfirm={remove}
          />
        </>
      ) : null}
    </div>
  );
}

function InviteRow({
  email,
  onRemoved,
}: {
  email: string;
  onRemoved: (email: string) => void;
}) {
  const [pending, start] = useTransition();
  function remove() {
    start(async () => {
      const res = await removeInvite(email);
      if (res.ok) {
        toast.success("Invite cancelled");
        onRemoved(email);
      } else toast.error(res.error);
    });
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{email}</div>
        <div className="text-xs text-muted-foreground">Joins when they sign in with this email</div>
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={remove}
        disabled={pending}
        aria-label="Cancel invite"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function LeaveButton() {
  const router = useRouter();
  async function leave() {
    const res = await leaveWorkspace();
    if (res.ok) {
      toast.success("Left the tracker");
      router.refresh();
    } else toast.error(res.error);
  }
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" className="w-full text-negative">
          <LogOut className="size-4" /> Leave this tracker
        </Button>
      }
      title="Leave this tracker?"
      description="You'll lose access until you're invited again."
      confirmLabel="Leave"
      onConfirm={leave}
    />
  );
}
