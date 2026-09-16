import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, categories, tags } from "./db/schema";

/** Foreign keys establish existence, not ownership. Validate before any write. */
export async function assertWorkspaceReferences(
  workspaceId: string,
  refs: {
    accountIds?: (string | null | undefined)[];
    categoryId?: string | null;
    tagIds?: string[];
  },
) {
  const db = await getDb();
  const accountIds = [
    ...new Set((refs.accountIds ?? []).filter((id): id is string => !!id)),
  ];
  if (accountIds.length) {
    const owned = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.workspaceId, workspaceId),
          inArray(accounts.id, accountIds),
        ),
      );
    if (owned.length !== accountIds.length)
      throw new Error("Choose an account from this workspace.");
  }
  if (refs.categoryId) {
    const [owned] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.workspaceId, workspaceId),
          eq(categories.id, refs.categoryId),
        ),
      )
      .limit(1);
    if (!owned) throw new Error("Choose a category from this workspace.");
  }
  const tagIds = [...new Set(refs.tagIds ?? [])];
  if (tagIds.length) {
    const owned = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.id, tagIds)));
    if (owned.length !== tagIds.length)
      throw new Error("Choose tags from this workspace.");
  }
}
