/** Roles are stored as text. Only known roles grant access. */
export const householdRoles = ["owner", "member", "viewer"] as const;

/** The migration reserves this prefix for new isolated ledgers. It is a
 * deny-only marker (e.g. for notifications); it never grants access. */
export function isPersonalLedger(id: string) {
  return id.startsWith("personal:");
}

export function trackerExportHref(workspace: string | null | undefined) {
  return "/api/export?" + new URLSearchParams({workspace: workspace ?? ""});
}

/** Always start in an accessible shared tracker; choosing a private view is explicit. */
export function signInTracker(memberships: {id:string;ownerId:string}[], actor:string) {
  const shared = memberships.filter(w => !isPersonalLedger(w.id));
  return (shared.find(w => w.ownerId === actor) ?? shared[0])?.id ?? null;
}
export function canEditSharedLedger(role: string | null | undefined) {
  return role === "owner" || role === "member";
}

export function canManageSharing(workspace: {role: string; ownerId: string} | null, actor: string) {
  return workspace?.role === "owner" && workspace.ownerId === actor;
}
