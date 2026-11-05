"use server";

import { ZodError } from "zod";
import { getSession } from "./session";
import { getHouseholdDb, type HouseholdDb } from "./household-db";
import { chooseWeeklyReview, finishWeeklyReview, loadWeeklyReview, WeeklyReviewError } from "./weekly-review-store";

async function run<T>(workspace: string, work: (db: HouseholdDb, scope: { workspace: string; actor: string }) => Promise<T>, optional = false) {
  try {
    const session = await getSession();
    if (!session || session.workspaceId !== workspace) throw new WeeklyReviewError("Reopen the household before continuing.");
    const db = await getHouseholdDb();
    if (!db) {
      if (optional) return { ok: true as const, value: null };
      throw new WeeklyReviewError("Weekly review is unavailable. Refresh to check your saved choices.");
    }
    return { ok: true as const, value: await work(db, { workspace, actor: session.user.id }) };
  } catch (error) {
    return { ok: false as const, error: error instanceof WeeklyReviewError ? error.message
      : error instanceof ZodError ? "Refresh the review and choose again."
      : "Couldn't confirm your review. Refresh to check your saved choices." };
  }
}

export async function readWeeklyReview(workspace: string) {
  return run(workspace, (db, scope) => loadWeeklyReview(db, scope), true);
}
export async function saveWeeklyReviewChoice(workspace: string, input: unknown) {
  return run(workspace, (db, scope) => chooseWeeklyReview(db, scope, input));
}
export async function completeWeeklyReview(workspace: string, input: unknown) {
  return run(workspace, (db, scope) => finishWeeklyReview(db, scope, input));
}
