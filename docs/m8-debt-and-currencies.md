# M8 · Debt and currencies

## Try it locally

Run `npm run dev:debt` for the single-currency debt release or `npm run dev:finance` for debt and currency booking. Both use the same isolated demo database on port 3138. Stop the first server before switching modes. The hosted application requires a separate release decision.

For a future hosted rollout, apply and verify the two additive migrations separately before enabling the web feature. Release the debt workflows first with `FINANCE_RELEASE=debt`. Enable currency bookings separately with `FINANCE_RELEASE=currencies` after the owner confirms the denominations and rate source. Hosted previews require a dedicated M8 rehearsal database. Production requires a second explicit opt-in, a fresh encrypted backup and a verified isolated restore. The app never runs these migrations on a hosted database at startup.

In Overview, Accounts, or Insights, open **Debt & currencies**. An owner chooses the reporting currency and confirms the denomination, role and sign convention of each account. A positive card or loan balance can be explicitly reviewed as an amount owed. The review records an adjustment and preserves the original account and its entries. Additional accounts remain unconfirmed until individually reviewed. Members can book activity. Viewers can read the report.

## Debt

- Purchases and newly assessed interest or fees each create one expense. A repayment is a transfer. Its destination amount is allocated among previously assessed interest, fees and the remaining principal. Only an additional source-account transfer fee creates another expense.
- A purchase refund credits the original account. It reduces spending, up to the unreimbursed purchase amount. An overpaid liability contributes to net worth without becoming liquid cash.
- Enter the statement’s opening and closing dates, due date, closing amount and minimum. Overlapping cycles are rejected.
- The loan estimate charges interest monthly on the opening principal at nominal APR divided by 12, rounds once, adds the monthly fee, then applies the payment. The final installment is capped at the amount due. A variable-rate scenario holds the entered rate constant. Payments too small to amortize or projections beyond 600 months are identified.

## Currency booking

- Enter actual posted amounts and rate evidence from a receipt or statement. An expense can include a merchant’s original currency and the corresponding posted account amount. A cross-currency transfer records the amount sent, actual amount received, exchange rate, evidence time and source. Optional source fees are booked separately in the same database transaction.
- Rates are destination units per source unit. Calculations use integer decimal arithmetic. JPY uses whole yen and the other currencies in the app’s picker use two decimal places. Conversion rounds half away from zero. The actual receipt leg wins for a rounding difference of at most one destination minor unit. The difference is stored. Larger differences require checking the quote and fees.
- Historical spending uses its booked reporting rate. Today's net worth uses the latest owner-entered valuation quote available as of now. Existing foreign activity can be booked by its ledger ID, including both legs of an older transfer. This adds the evidence without duplicating the original posting.
- Missing evidence leaves the relevant total incomplete. Confirmed balances remain available by currency. Original single-currency budget, forecast and reporting tools are available separately with their assumptions labeled.
- Reporting currency and confirmed account denominations are fixed for this release. There is no automatic market-rate feed. The workbook includes the original ledger and the M8 evidence. Encrypted backups include the full records with exact decimal strings.

## Acceptance

`npm test` covers CAD, USD and JPY, purchases and refunds, debt payments and fees, current versus booked rates, missing evidence, retries, monthly payoff and permission checks. `npm run rehearse:m8-backup` builds older synthetic records, applies migrations 0029 and 0030 separately, then compares the original financial records and restores all three encrypted archives independently. It takes no live database input.

The November 4 rehearsal independently restored archives of 6, 8 and 18 synthetic rows. In the CAD reporting fixture, cash reconciled to CAD 916.00, debt to CAD 385.00 and net worth to CAD 531.00. Updating the USD valuation moved net worth to CAD 561.00 while booked spending stayed CAD 71.00. In the browser, confirming the three seeded demo accounts changed the summary from incomplete to separate cash, debt and net-worth totals. `npm run build:finance` produced the optimized web build.
