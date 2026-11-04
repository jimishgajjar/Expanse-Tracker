// Dependency order also defines the restore order for an encrypted backup.
export const debtTables=["finance_accounts","debt_statements","loan_terms"] as const;
export const currencyTables=["finance_books","account_denominations","valuation_quotes","finance_operations","finance_bookings"] as const;
