"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, LogOut, Plus, Trash2, UserRound, Users } from "lucide-react";
import { ManagerPanel, PanelCreate } from "./manager-panel";
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

function RoleBadge({ role }: { role: string }) {
  if (role === "owner")
    return (
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Owner
      </span>
    );
  if (role === "viewer")
    return (
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Viewer
      </span>
    );
  return null;
}

export function MembersManager({
  trigger,
  members: initialMembers,
  invites: initialInvites,
  currentEmail,
  workspaceName,
  isOwner,
}: {
  trigger: ReactElement;
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
      trigger={trigger}
      title="Members & sharing"
      icon={Users}
      description={
        isOwner
          ? `Manage access to ${workspaceName}. Each person signs in with their own account.`
          : `You have shared access to ${workspaceName}.`
      }
    >
      <div className="space-y-4">
        {isOwner && (
          <PanelCreate title="Invite someone">
            <InviteForm onInvited={onInvited} />
          </PanelCreate>
        )}
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Members · {members.length}
          </div>
          <div className="space-y-1.5">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isMe={m.email === currentEmail}
                canManage={isOwner}
                onRemoved={onMemberRemoved}
                onTransferred={onTransferred}
              />
            ))}
          </div>
        </div>
        {isOwner && invites.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Pending invites · {invites.length}
            </div>
            <div className="space-y-1.5">
              {invites.map((e) => (
                <InviteRow key={e} email={e} onRemoved={onInviteRemoved} />
              ))}
            </div>
          </div>
        )}
        {!isOwner && <LeaveButton />}
      </div>
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
        toast.success(res.member ? "Member added" : "Invitation sent");
        setEmail("");
        onInvited(res.member ?? null, res.invite ?? null);
      } else toast.error(res.error);
    });
  }
  return (
    <form onSubmit={add} className="space-y-4">
      <div className="flex gap-2">
        <Input
          aria-label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@email.com"
        />
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" /> Invite
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Access:
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "member" | "viewer")}
          className="rounded-md border border-input bg-background px-2 py-1 text-foreground"
        >
          <option value="member">Can edit</option>
          <option value="viewer">View only</option>
        </select>
      </label>
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
    <div className="flex items-center gap-2.5 rounded-xl border bg-card p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
        <UserRound className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">
            {member.name || member.email}
          </span>
          <RoleBadge role={member.role} />
        </div>
        {member.name && (
          <div className="truncate text-xs text-muted-foreground">
            {member.email}
          </div>
        )}
      </div>
      {isMe ? (
        <span className="text-xs text-muted-foreground">You</span>
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
    <div className="flex items-center gap-2.5 rounded-xl border border-dashed bg-card p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{email}</div>
        <div className="text-xs text-muted-foreground">Pending</div>
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
