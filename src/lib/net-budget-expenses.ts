// Category budgets recognize a return on the date the credit reached the ledger.
export const netBudgetExpenses = `(
  SELECT t.id,t.workspace_id,t.account_id,t.type,t.date,
    coalesce(p.category_id,t.category_id) AS category_id,coalesce(p.amount,t.amount) AS amount
  FROM transactions t LEFT JOIN purchase_allocations p ON p.transaction_id=t.id WHERE t.type='expense'
  UNION ALL
  SELECT c.id,c.workspace_id,c.account_id,'expense',c.date,line->>'categoryId',-(line->>'amount')::numeric
  FROM refund_links r JOIN transactions c ON c.id=r.credit_id AND c.workspace_id=r.workspace_id
  CROSS JOIN LATERAL jsonb_array_elements(r.portions) line
)`;
