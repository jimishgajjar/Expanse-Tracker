# Observe five households

Prepare blank working materials with `npm run pilot:prepare -- YYYY-MM-DD`, using the preparation date. This creates a new ignored folder with H01–H05 worksheets, the synthetic statement, operating instructions and an empty M15 report. It does not enroll households or start the four-week clock. Open the returned `START-HERE.md` and confirm the enrollment checks below before contacting participants.

## Enrollment checklist

The facilitator collects the observations. The backup contact handles an incident or withdrawal if the facilitator is away. Before inviting anyone, record their names, staffed hours, who can read feedback, when contact details and worksheets will be deleted, and how a household can withdraw. Keep that operator record and the contact-to-code key outside Git with restricted access. Use an approved, access-controlled preview with separate household workspaces. Complete the [pilot enrollment checks](pilot-operations.md#before-anyone-is-invited).

Coordinate replacement of the previously exposed production database credential across the live app and the scheduled backup. Verify sign-in, a read-only balance comparison and a fresh restore with the replacement credential before retiring the old credential. Keep the encrypted backup on the operator's computer. When the computer is off, scheduled backups can fall behind. Losing the computer and its only protected key or archive can prevent recovery. The owner and backup contact must understand how they would recover access before enrollment.

## Session

Allow 25–35 minutes. Assign the next household code, H01 through H05, in order. Two people working together in one tracker count once. Give each household a fresh practice workspace. A facilitator demonstrating the flow can use a separate workspace.

Read aloud, “We're testing whether the tracker is easy to use. We'll use made-up figures. You can skip a task or stop at any time. May I take anonymous notes about the steps you take? Separately, may I time the tasks?” Explain access, deletion and withdrawal before asking. Agree separately with each person being observed. Take no recordings. If observation is declined, end the observation. A household that declines timing can still take part. No personal statements, bank accounts, passwords, emails or participant names belong in the worksheet.

Give one prompt at a time. Keep the answer column out of view. Begin elapsed time at the first action and stop when the participant confirms the intended result or stops. For capture, start when they open Add transaction and stop at save confirmation. Verify retrieval separately. First allow a practice entry in a separate practice tracker so capture is familiar. Before giving a hint, record where the person stopped. Once you help, score a successful task as assisted.

| Task | Read to the participant | Facilitator check |
| --- | --- | --- |
| Setup | “Set up a Canadian-dollar chequing account named Practice chequing. Its October 1, 2026 statement closed at C$100. Use Toronto time. You're doing setup alone today. Leave setup and come back to show me what was saved.” | The saved preferences, account and confirmed October 1 cutoff survive reopening. The later reconciliation step can be pending. |
| Capture | “On October 2 you spent C$7.50 at Market. Enter the expense and show me where it went.” | Exactly one expense in the practice account. Stop the timer at save confirmation. |
| Import review | “Bring this practice statement into the tracker. One payment is already there. Show me how you know what was posted.” Give them [the CSV](pilot-statement.csv). | The Market row matches the capture. The service fee imports once. Reopening the receipt shows both decisions. The account has two expenses and C$90.00. |
| Reconciliation | “Your October 2–3 statement closes at C$90. Compare it with the tracker and decide whether you can close the review.” | Two cleared entries, zero difference, completed review. Stop and investigate an unexplained difference. |
| Forecast | “There is one C$20 utility bill due tomorrow. Looking ahead 30 days, when will this account be lowest, and why?” | Before handing over, add a single estimate-only expense bill named Practice utility for tomorrow, ending the same day. Disable alerts and automatic posting. With the base scenario, zero daily spend, no other schedules or reservations, the projected low is C$70 tomorrow. The recorded balance is still C$90. |
| Weekly review | “Find what the household needs to do this week. What would you do next?” | Participant finds Practice utility due tomorrow and identifies an action, such as arranging payment or checking it was paid. The exercise ends before recording a payment. |

If a task fails, freeze its result. The facilitator may repair the practice fixture before the next task so one failure does not prevent five more observations. Note the reset. Never count a facilitator repair as a participant completion.

## Private worksheet — copy once per household

Household code ___ · Session date ___ · Preview build ___ · Device class ___ · Observation consent ___ · Timing consent ___ · Week-four contact consent ___

Use U for completed unassisted, A for completed with help, I for attempted but unfinished, and a dash for never attempted. Leave time blank when timing was declined. Keep only a short description of the interface step. Record a sanitized feedback reference for a critical incident, with a separate resolution status.

| Task | U / A / I / – | Elapsed seconds | First sticking point, help given, or reason for stopping |
| --- | --- | --- | --- |
| Setup | | | |
| Capture | | | |
| Import review | | | |
| Reconciliation | | | |
| Forecast | | | |
| Weekly review | | | |

Unexplained balance or unexpected ledger movement ___ · Visibility/privacy incident ___ · Follow-up owner and status ___

Enrollment is day 0. Week four starts 21 days after the session and ends at the close of day 27. For the original household only, record voluntary return and completed review in that window, the date relative to enrollment, and how it was confirmed with consent. Finalize its outcome **on day 28 or later**, after the whole window has elapsed. Before then, keep the M15 evidence return/review/reason fields null even if an interim observation is recorded in the worksheet. A prompted demonstration is assisted. Track households still waiting, withdrawn, or with unknown return separately; missing or withdrawn evidence is not an observed non-return. Include all original households whose full window has elapsed in the final denominator and disclose outcomes you could not verify. The M15 report prints each enrolled household's window and readout dates; it sends no reminders.

## Decide from the five sessions

1. Copy [the empty scorecard](pilot-evidence.empty.json) outside Git. For each task count U + A + I as attempted, U as unassisted, A as assisted. Keep the original enrollment order for the first-five setup measure. Report any unobserved or withdrawn sessions explicitly and leave the gate open if the first five cannot be evaluated.
2. Use the one timed, successful, unassisted familiar capture from each consenting household for the median. Alongside it show sample size, all attempted captures, assisted completions, unfinished attempts and missing timings. No timed successes means the median is unknown. Target under 10 seconds.
3. For each recurring obstacle, count distinct affected households, list the task and describe the consequence. Rank by affected households, breaking ties by severity (blocks task, requires help, slows task). Report the top two with counts. Investigate any privacy exposure or unexplained balance immediately, even if it happens only once.
4. Run `npm run pilot:report -- <private-evidence.json>`. Record whether at least four of the first five set up unassisted. Report balance and privacy incidents observed, still unresolved, and observation coverage independently. Repeat a recurring setup or reconciliation failure after the fix. Schedule the week-four readout with the original cohort.

**Evidence boundary.** A synthetic run can check balances, retries and access rules. Leave household counts, human timings, rankings and retention empty until observed. Keep rehearsals in a separate record.

## M12 weekly review exercise

Use the same consent, household codes and restricted worksheets above. Use a separate synthetic household with no bank connection, automatic posting or notifications. For a consistent exercise, keep a C$90 practice balance, a C$20 Practice utility bill due tomorrow, an outstanding C$12 reimbursement and an Emergency fund goal of C$500. Each partner uses their own member login. Do not use real account or participant details.

Before the timed task, let the participant practice marking the utility bill Reviewed and finishing a review. Then, with the participant looking away, change the practice bill from C$20 to C$27 through Subscriptions & bills. This is the seeded discrepancy. Changing an estimate must leave the recorded account balance at C$90. Leave the other items unresolved. Reopen Overview before starting the task.

Read, “Find this week's household review. Something changed since the last review. Tell me what changed and what you would do next. Save your choices, leaving something for next week if you wish, and finish. Show me what remains.” Start the timer at their first action, stop at their finished receipt or when they stop. Record help before offering it. Do not tell them where the changed badge or review link is.

Verify the C$27 bill is identified, the participant describes an appropriate action in their own words, the saved receipt distinguishes reviewed, deferred and open items, and reopening preserves their choices. The exercise stops before recording any payment. Confirm that the original C$90 balance and transaction history remain unchanged. A second partner should still have their own unreviewed list.

| Household code | U / A / I / – | Seconds, if consented | C$27 discrepancy identified | Next action explained | Receipt and resume verified | Help or obstacle |
| --- | --- | --- | --- | --- | --- | --- |
| H01 | | | | | | |
| H02 | | | | | | |
| H03 | | | | | | |
| H04 | | | | | | |
| H05 | | | | | | |

Report the number of households that satisfy all three conditions — unassisted completion within 300 seconds, discrepancy identification and a clear next action — out of the original five. Target at least four. Missing timing is unknown, not a pass. Track privacy and balance incidents independently. Use the same day-21–27 follow-up window above to report voluntary completed reviews, targeting at least three of five eligible households. No automated emails, recruitment or retention claims follow from preparing this exercise.

## M13 purchase decision exercise

Use the same consent and household codes, with a separate synthetic household. Set one CAD cash account to C$1,000 today, reserve C$200 for a goal, and confirm a C$100 buffer and C$0 daily spending. Include recent practice income and expense with zero net effect so evidence is current. Schedule a C$100 utility bill for tomorrow and record C$500 expected incoming activity for day three. Keep automatic posting, bank connections and notifications off. Do not use real financial details or encourage a real purchase.

Read, “You are considering a C$300 purchase five days from today. Work out how this changes your lowest balance, what is protected, and what might change the answer. Explain what you would do next.” Do not point out the panel, the low date or the delayed-income example. Record assistance before giving it. The original and proposed lowest balances both remain C$900 tomorrow, before the purchase; delaying the C$500 arrival seven days produces a C$600 low on the purchase date. Ask why the minimum stayed the same in the first case. Then ask them to try C$700 tomorrow: the C$200 minimum is C$100 below the C$300 protected amount. Confirm they distinguish cash in the account from cash above reservations and the buffer.

Ask them to save the original plan, close the scenario and reopen it. Verify that the proposed purchase is cleared and the ledger did not change. To test the comparison without waiting, the facilitator may use a separately seeded historical practice baseline: C$1,000 two days ago, a C$100 bill planned tomorrow, then a C$25 repair yesterday and that bill paid today. The comparison through today must show a C$125 difference, split into early payment and additional spending. Do not label either as a projection error or unpaid bill without evidence. Keep time travel or fixture insertion out of a live household.

| Household code | U / A / I / – | Explains unchanged minimum and date | Explains delayed income and protected cash | Explains C$125 difference | Clear next action | Help or obstacle |
| --- | --- | --- | --- | --- | --- | --- |
| H01 | | | | | | |
| H02 | | | | | | |
| H03 | | | | | | |
| H04 | | | | | | |
| H05 | | | | | | |

Report correct explanations out of the original five, targeting at least four unassisted. Record misinterpretations and any unexpected posting or visibility incident separately. Automated arithmetic, synthetic browser checks and a mobile-width screenshot are engineering evidence; they do not count as participant comprehension or physical-phone acceptance.
