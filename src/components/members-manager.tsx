"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, UserRound } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { inviteMember, leaveWorkspace, removeInvite, removeMember } from "@/lib/sharing";
import type { MemberDTO } from "@/lib/queries";

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
  // Local copies so the open sheet reflects invites/removals instantly.
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);

  function onInvited(member: MemberDTO | null, invite: string | null) {
    if (member) setMembers((m) => (m.some((x) => x.id === member.id) ? m : [...m, member]));
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

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Sharing — {workspaceName}</SheetTitle>
          <SheetDescription>
            {isOwner
              ? "People you add can sign in and access & edit everything in this tracker."
              : "You have shared access to this tracker."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {isOwner && <InviteForm onInvited={onInvited} />}
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Members · {members.length}</div>
            <div className="space-y-1.5">
              {members.map((m) => (
                <MemberRow key={m.id} member={m} isMe={m.email === currentEmail} canRemove={isOwner} onRemoved={onMemberRemoved} />
              ))}
            </div>
          </div>
          {isOwner && invites.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Pending invites · {invites.length}</div>
              <div className="space-y-1.5">{invites.map((e) => <InviteRow key={e} email={e} onRemoved={onInviteRemoved} />)}</div>
            </div>
          )}
          {!isOwner && <LeaveButton />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InviteForm({ onInvited }: { onInvited: (member: MemberDTO | null, invite: string | null) => void }) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    start(async () => {
      const res = await inviteMember({ email });
      if (res.ok) {
        toast.success(res.member ? "Member added" : "Invitation sent");
        setEmail("");
        onInvited(res.member ?? null, res.invite ?? null);
      } else toast.error(res.error);
    });
  }
  return (
    <form onSubmit={add} className="flex gap-2">
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@email.com" />
      <Button type="submit" disabled={pending}><Plus className="size-4" /> Invite</Button>
    </form>
  );
}

function MemberRow({ member, isMe, canRemove, onRemoved }: { member: MemberDTO; isMe: boolean; canRemove: boolean; onRemoved: (id: string) => void }) {
  async function remove() {
    const res = await removeMember(member.id);
    if (res.ok) { toast.success("Member removed"); onRemoved(member.id); }
    else toast.error(res.error);
  }
  return (
    <div className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><UserRound className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{member.name || member.email}</div>
        {member.name && <div className="truncate text-xs text-muted-foreground">{member.email}</div>}
      </div>
      {isMe ? (
        <span className="text-xs text-muted-foreground">You</span>
      ) : canRemove ? (
        <ConfirmDialog
          trigger={<Button size="icon-sm" variant="ghost" aria-label="Remove member"><Trash2 className="size-3.5" /></Button>}
          title={`Remove ${member.email}?`}
          description="They will lose access to this tracker (their own account is untouched)."
          onConfirm={remove}
        />
      ) : null}
    </div>
  );
}

function InviteRow({ email, onRemoved }: { email: string; onRemoved: (email: string) => void }) {
  const [pending, start] = useTransition();
  function remove() {
    start(async () => {
      const res = await removeInvite(email);
      if (res.ok) { toast.success("Invite cancelled"); onRemoved(email); }
      else toast.error(res.error);
    });
  }
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed px-2.5 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{email}</div>
        <div className="text-xs text-muted-foreground">Pending</div>
      </div>
      <Button size="icon-sm" variant="ghost" onClick={remove} disabled={pending} aria-label="Cancel invite"><Trash2 className="size-3.5" /></Button>
    </div>
  );
}

function LeaveButton() {
  const router = useRouter();
  async function leave() {
    const res = await leaveWorkspace();
    if (res.ok) { toast.success("Left the tracker"); router.refresh(); }
    else toast.error(res.error);
  }
  return (
    <ConfirmDialog
      trigger={<Button variant="outline" size="sm" className="w-full text-negative"><LogOut className="size-4" /> Leave this tracker</Button>}
      title="Leave this tracker?"
      description="You'll lose access until you're invited again."
      confirmLabel="Leave"
      onConfirm={leave}
    />
  );
}
