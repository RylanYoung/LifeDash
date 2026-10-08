/** The two scheduled prompts. Shared by Settings (to copy) and Today (to run now). */
export const MORNING = `Use the LifeDash connector. Call get_today, then get_business_context.
Write my morning brief in short Markdown:
1. Top 3 things to do today, most important first, and why.
2. Today's schedule, with any prep each meeting needs.
3. Emails that need a reply from me: who, and what they need.
4. Anything overdue.
If my emails contain a durable business fact (a client signed, a price changed, a new deadline), save each one with add_context_fact. Ignore personal matters for context.
Plain language, no em dashes. Save it with save_brief, kind "morning".`;

export const RECAP = `Use the LifeDash connector. Call get_today.
Write my evening recap in short Markdown:
1. What got done today.
2. What is still open and should roll to tomorrow.
3. Emails still waiting on me.
4. Tomorrow's first event and anything to prepare tonight.
Plain language, no em dashes. Save it with save_brief, kind "recap".`;
