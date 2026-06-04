"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, UserRound } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { inviteMember, removeInvite, removeMember } from "@/lib/sharing";
import type { MemberDTO } from "@/lib/queries";

export function MembersManager({
  trigger,
  members,
  invites,
  currentEmail,
}: {
  trigger: ReactElement;
  members: MemberDTO[];
  invites: string[];
  currentEmail: string;
}) {
  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Sharing</SheetTitle>
          <SheetDescription>People you add can sign in and access &amp; edit all of this account&apos;s data.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <InviteForm />
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Members · {members.length}</div>
            <div className="space-y-1.5">
              {members.map((m) => <MemberRow key={m.id} member={m} isMe={m.email === currentEmail} />)}
            </div>
          </div>
          {invites.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Pending invites · {invites.length}</div>
              <div className="space-y-1.5">{invites.map((e) => <InviteRow key={e} email={e} />)}</div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InviteForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    start(async () => {
      const res = await inviteMember({ email });
      if (res.ok) { toast.success("Invitation sent"); setEmail(""); router.refresh(); }
      else toast.error(res.error);
    });
  }
  return (
    <form onSubmit={add} className="flex gap-2">
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@email.com" />
      <Button type="submit" disabled={pending}><Plus className="size-4" /> Invite</Button>
    </form>
  );
}

function MemberRow({ member, isMe }: { member: MemberDTO; isMe: boolean }) {
  const router = useRouter();
  async function remove() {
    const res = await removeMember(member.id);
    if (res.ok) { toast.success("Member removed"); router.refresh(); }
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
      ) : (
        <ConfirmDialog
          trigger={<Button size="icon-sm" variant="ghost" aria-label="Remove member"><Trash2 className="size-3.5" /></Button>}
          title={`Remove ${member.email}?`}
          description="They will lose access to this account."
          onConfirm={remove}
        />
      )}
    </div>
  );
}

function InviteRow({ email }: { email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function remove() {
    start(async () => {
      const res = await removeInvite(email);
      if (res.ok) { toast.success("Invite cancelled"); router.refresh(); }
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
