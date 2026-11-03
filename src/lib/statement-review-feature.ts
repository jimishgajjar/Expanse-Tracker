/** Enable only after the additive migration and verified backup are ready. */
export function statementReviewsEnabled() {
  return process.env.STATEMENT_REVIEWS_ENABLED === "1";
}
export function statementCorrectionsEnabled() {
  return statementReviewsEnabled() && process.env.STATEMENT_CORRECTIONS_ENABLED === "1";
}
