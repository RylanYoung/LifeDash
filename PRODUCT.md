# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js 16 (App Router) + Tailwind v4 + Supabase (auth, Postgres with row-level security), hosted on Vercel, source on GitHub. Matches the owner's other projects (sales-crm, revena-portal).

## Users
One person: Rylan Young, founder of Solven Growth (childcare AI growth business) and other ventures. Uses it daily on desktop and phone as the one place that runs their whole life: email, calendar, to-dos and business context.

## Product Purpose
A private life dashboard. Success is opening it each morning, reading the brief, and knowing exactly what to do, then working email, calendar and tasks without switching apps.

## Positioning
It is Claude-native. The dashboard exposes its own MCP connector so the owner's Claude (Pro plan, no API key) can read and change tasks, read business context, read email and calendar, and write the daily brief and recap back into the dashboard.

## Operating Context
- Morning: read the brief Claude wrote, scan today's schedule and due tasks.
- Through the day: triage Gmail, reply and send; add and edit calendar events; tick off tasks and checkpoints.
- Evening: read the recap.
- From any Claude chat: "add a task to Solven Growth under Outreach", "what's left on my list".

## Capabilities and Constraints
- Gmail: read, search, reply, send, archive, mark read.
- Google Calendar: view, create, edit, delete events.
- To-dos: Lists (e.g. "Solven Growth", "Personal") > Categories (with a description) > Tasks > Checkpoints.
- A list is either Business or Personal. Only Business lists feed the AI business context. Personal lists stay out of context but remain reachable through the MCP on request.
- Business context: owner-written notes (offer, website, goals, clients) plus facts Claude learns from email over time.
- AI runs on the owner's Claude Pro plan via scheduled Claude routines and the MCP connector. No Anthropic API key.
- Single user. Not public. Must not be indexed by search engines.
- Open: Obsidian vault sync (deferred by owner).

## Brand Commitments
Premium, custom, never generic. Never use em dashes anywhere.

## Evidence on Hand
No real data yet. Do not fabricate tasks, emails or events in the shipped app; empty states must teach instead.

## Product Principles
1. Today first: the home view answers "what do I do now".
2. Zero-friction capture: adding a task is always one keystroke or one tap away.
3. Context is curated: business is in, personal is out, and the owner can see exactly what Claude knows.
4. Fast on phone: every core action works one-handed.
