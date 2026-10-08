import type { SupabaseClient } from "@supabase/supabase-js";
import { account, createEvent, getThread, listEvents, listThreads, sendMail } from "./google";

/**
 * Everything Claude can do through the connector. Runs as the owner under RLS.
 *
 * Context rule: get_business_context only ever returns business lists.
 * Personal lists are reachable through the task tools when asked, but never
 * bundled into context.
 */

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const TOOLS = [
  {
    name: "get_today",
    description:
      "Everything for a morning brief or evening recap in one call: today's date and time zone, today's calendar, unread inbox threads, tasks due today or overdue (business and personal), tasks completed today, and the latest brief. Call this first.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "save_brief",
    description:
      "Save a morning brief or evening recap to the dashboard's Today page. Write in Markdown: short sections, plain language, most important first. Never use em dashes.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["morning", "recap"] },
        content: { type: "string", description: "Markdown body." },
      },
      required: ["kind", "content"],
    },
  },
  {
    name: "get_business_context",
    description:
      "The owner's business context: notes they wrote (offer, website, goals...), facts learned over time, and every BUSINESS list with its categories and open tasks. Personal lists are deliberately excluded.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_context_fact",
    description:
      "Remember one durable business fact (a client signed, a price changed, a new goal). Only business facts; never personal details. One fact per call, one sentence.",
    inputSchema: {
      type: "object",
      properties: { fact: { type: "string" }, source: { type: "string", description: "Where it came from, e.g. 'email from Jane, 8 Oct'." } },
      required: ["fact"],
    },
  },
  {
    name: "list_lists",
    description: "All to-do lists with their kind (business or personal), categories and open task counts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_tasks",
    description: "Tasks in a list (by name or id), optionally one category, with checkpoints.",
    inputSchema: {
      type: "object",
      properties: {
        list: { type: "string", description: "List name or id." },
        category: { type: "string", description: "Category name or id (optional)." },
        include_done: { type: "boolean", default: false },
      },
      required: ["list"],
    },
  },
  {
    name: "create_task",
    description: "Add a task. Optionally put it in a category, give it a due date and checkpoints (sub-steps).",
    inputSchema: {
      type: "object",
      properties: {
        list: { type: "string", description: "List name or id." },
        category: { type: "string", description: "Category name or id (optional)." },
        title: { type: "string" },
        notes: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        checkpoints: { type: "array", items: { type: "string" } },
      },
      required: ["list", "title"],
    },
  },
  {
    name: "update_task",
    description: "Change a task's title, notes, due date (empty string clears it), category, or done state.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        notes: { type: "string" },
        due_date: { type: "string" },
        category: { type: "string", description: "Category name or id in the same list." },
        done: { type: "boolean" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "complete_task",
    description: "Tick off a task by id, or by title when it is unambiguous.",
    inputSchema: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" } } },
  },
  {
    name: "add_checkpoint",
    description: "Add a checkpoint (sub-step) to a task.",
    inputSchema: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" } }, required: ["task_id", "title"] },
  },
  {
    name: "set_checkpoint",
    description: "Tick or untick a checkpoint.",
    inputSchema: {
      type: "object",
      properties: { checkpoint_id: { type: "string" }, done: { type: "boolean", default: true } },
      required: ["checkpoint_id"],
    },
  },
  {
    name: "create_category",
    description: "Add a category (with a description of what belongs in it) to a list.",
    inputSchema: {
      type: "object",
      properties: { list: { type: "string" }, name: { type: "string" }, description: { type: "string" } },
      required: ["list", "name"],
    },
  },
  {
    name: "create_list",
    description: "Create a to-do list. kind 'business' feeds the AI business context; 'personal' does not.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, kind: { type: "string", enum: ["business", "personal"] }, description: { type: "string" } },
      required: ["name", "kind"],
    },
  },
  {
    name: "search_email",
    description: "Search Gmail with normal Gmail syntax (from:, newer_than:2d, is:unread...). Returns thread summaries.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, max: { type: "integer", default: 15 } }, required: ["query"] },
  },
  {
    name: "read_email",
    description: "Read a full email thread as plain text.",
    inputSchema: { type: "object", properties: { thread_id: { type: "string" } }, required: ["thread_id"] },
  },
  {
    name: "send_email",
    description: "Send an email from the owner's Gmail. Pass thread_id to reply in a thread. Only send when the owner has asked you to.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        cc: { type: "string" },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text." },
        thread_id: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "list_events",
    description: "Calendar events between two ISO datetimes.",
    inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] },
  },
  {
    name: "create_event",
    description: "Add a calendar event. start/end are ISO datetimes with offset, or YYYY-MM-DD with all_day.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        all_day: { type: "boolean" },
        description: { type: "string" },
        location: { type: "string" },
      },
      required: ["title", "start", "end"],
    },
  },
];

/* ---------------------------------------------------------------- helpers */

function check<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as NonNullable<T>;
}

async function resolveList(sb: SupabaseClient, ref: string) {
  const lists = check(await sb.from("lists").select("id, name, kind"));
  const hit =
    lists.find((l) => l.id === ref) ??
    lists.find((l) => l.name.toLowerCase() === ref.toLowerCase()) ??
    lists.filter((l) => l.name.toLowerCase().includes(ref.toLowerCase())).at(0);
  if (!hit) throw new Error(`No list called "${ref}". Lists: ${lists.map((l) => l.name).join(", ") || "none"}.`);
  return hit;
}

async function resolveCategory(sb: SupabaseClient, listId: string, ref: string) {
  const cats = check(await sb.from("categories").select("id, name").eq("list_id", listId));
  const hit = cats.find((c) => c.id === ref) ?? cats.find((c) => c.name.toLowerCase() === ref.toLowerCase());
  if (!hit) throw new Error(`No category "${ref}" in that list. Categories: ${cats.map((c) => c.name).join(", ") || "none"}.`);
  return hit;
}

function todayIn(tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts; // YYYY-MM-DD
}

/** Midnight-to-midnight bounds of a local date, as ISO instants. */
function dayBounds(date: string, tz: string) {
  const probe = new Date(`${date}T12:00:00Z`);
  const local = new Date(probe.toLocaleString("en-US", { timeZone: tz }));
  const offset = local.getTime() - probe.getTime();
  const start = new Date(new Date(`${date}T00:00:00Z`).getTime() - offset);
  return { from: start.toISOString(), to: new Date(start.getTime() + 86_400_000).toISOString() };
}

async function tasksWithCheckpoints<T extends { id: string }>(sb: SupabaseClient, tasks: T[]) {
  if (!tasks.length) return [] as (T & { checkpoints: unknown[] })[];
  const cps = check(await sb.from("checkpoints").select("id, task_id, title, done").in("task_id", tasks.map((t) => t.id)).order("position"));
  return tasks.map((t) => ({ ...t, checkpoints: cps.filter((c) => c.task_id === t.id).map(({ task_id: _, ...c }) => c) }));
}

async function nextPosition(sb: SupabaseClient, table: string, col: string, val: string) {
  const rows = check(await sb.from(table).select("position").eq(col, val).order("position", { ascending: false }).limit(1));
  return ((rows[0] as { position: number } | undefined)?.position ?? 0) + 1;
}

/* ------------------------------------------------------------------ tools */

export async function callTool(sb: SupabaseClient, userId: string, name: string, a: Args): Promise<unknown> {
  switch (name) {
    case "get_today": {
      const acc = await account(sb);
      const tz = acc?.time_zone ?? "UTC";
      const today = todayIn(tz);
      const { from, to } = dayBounds(today, tz);
      const lists = check(await sb.from("lists").select("id, name, kind"));
      const listName = (id: string) => lists.find((l) => l.id === id);
      const due = check(await sb.from("tasks").select("id, title, due_date, list_id").eq("done", false).lte("due_date", today).order("due_date"));
      const doneToday = check(await sb.from("tasks").select("id, title, list_id").eq("done", true).gte("done_at", from));
      const brief = check(await sb.from("briefs").select("kind, for_date, content").order("created_at", { ascending: false }).limit(1));
      const google = acc
        ? await Promise.all([listEvents(userId, sb, from, to), listThreads(userId, sb, { folder: "unread", max: 15 })]).catch((e) => e as Error)
        : new Error("Google not connected");
      const label = (t: { list_id: string }) => ({ list: listName(t.list_id)?.name, kind: listName(t.list_id)?.kind });
      return {
        date: today,
        time_zone: tz,
        calendar: google instanceof Error ? `unavailable: ${google.message}` : google[0],
        unread_email: google instanceof Error ? `unavailable: ${google.message}` : google[1],
        tasks_due: (await tasksWithCheckpoints(sb, due)).map((t) => ({ ...t, ...label(t as { list_id: string }), overdue: (t as { due_date: string }).due_date < today })),
        completed_today: doneToday.map((t) => ({ title: t.title, ...label(t) })),
        latest_brief: brief[0] ?? null,
      };
    }

    case "save_brief": {
      const kind = str(a.kind);
      const content = str(a.content).replace(/—|–/g, ",");
      if (!["morning", "recap"].includes(kind) || !content) throw new Error("kind (morning|recap) and content are required.");
      const tz = (await account(sb))?.time_zone ?? "UTC";
      const row = check(await sb.from("briefs").insert({ kind, content, for_date: todayIn(tz) }).select("id, kind, for_date").single());
      return { saved: row };
    }

    case "get_business_context": {
      const notes = check(await sb.from("context_notes").select("title, body").order("position"));
      const facts = check(await sb.from("context_facts").select("fact, source, created_at").order("created_at", { ascending: false }).limit(200));
      const lists = check(await sb.from("lists").select("id, name, description").eq("kind", "business").order("position"));
      const ids = lists.map((l) => l.id);
      const cats = ids.length ? check(await sb.from("categories").select("id, list_id, name, description").in("list_id", ids).order("position")) : [];
      const tasks = ids.length
        ? check(await sb.from("tasks").select("id, list_id, category_id, title, notes, due_date").in("list_id", ids).eq("done", false).order("position"))
        : [];
      return {
        notes,
        learned_facts: facts,
        business_lists: lists.map((l) => ({
          name: l.name,
          description: l.description,
          categories: cats
            .filter((c) => c.list_id === l.id)
            .map((c) => ({ name: c.name, description: c.description, open_tasks: tasks.filter((t) => t.category_id === c.id).map((t) => t.title) })),
          uncategorised_open_tasks: tasks.filter((t) => t.list_id === l.id && !t.category_id).map((t) => t.title),
        })),
      };
    }

    case "add_context_fact": {
      const fact = str(a.fact);
      if (!fact) throw new Error("fact is required.");
      return check(await sb.from("context_facts").insert({ fact, source: str(a.source) || "claude" }).select("id, fact").single());
    }

    case "list_lists": {
      const lists = check(await sb.from("lists").select("id, name, kind, description").order("position"));
      const cats = check(await sb.from("categories").select("id, list_id, name, description").order("position"));
      const open = check(await sb.from("tasks").select("list_id").eq("done", false));
      return lists.map((l) => ({
        ...l,
        open_tasks: open.filter((t) => t.list_id === l.id).length,
        categories: cats.filter((c) => c.list_id === l.id).map(({ list_id: _, ...c }) => c),
      }));
    }

    case "list_tasks": {
      const list = await resolveList(sb, str(a.list));
      let q = sb.from("tasks").select("id, title, notes, due_date, done, category_id").eq("list_id", list.id).order("position");
      if (!a.include_done) q = q.eq("done", false);
      if (str(a.category)) q = q.eq("category_id", (await resolveCategory(sb, list.id, str(a.category))).id);
      const cats = check(await sb.from("categories").select("id, name").eq("list_id", list.id));
      const tasks = await tasksWithCheckpoints(sb, check(await q));
      return {
        list: list.name,
        kind: list.kind,
        tasks: tasks.map((t) => ({ ...t, category: cats.find((c) => c.id === (t as { category_id: string | null }).category_id)?.name ?? null })),
      };
    }

    case "create_task": {
      const list = await resolveList(sb, str(a.list));
      const title = str(a.title);
      if (!title) throw new Error("title is required.");
      const category_id = str(a.category) ? (await resolveCategory(sb, list.id, str(a.category))).id : null;
      const task = check(
        await sb
          .from("tasks")
          .insert({
            list_id: list.id,
            category_id,
            title,
            notes: str(a.notes),
            due_date: str(a.due_date) || null,
            position: await nextPosition(sb, "tasks", "list_id", list.id),
          })
          .select("id, title, due_date")
          .single()
      );
      const steps = Array.isArray(a.checkpoints) ? a.checkpoints.map(str).filter(Boolean) : [];
      if (steps.length) check(await sb.from("checkpoints").insert(steps.map((t, i) => ({ task_id: task.id, title: t, position: i + 1 }))));
      return { created: task, list: list.name, checkpoints: steps.length };
    }

    case "update_task": {
      const id = str(a.task_id);
      const patch: Record<string, unknown> = {};
      if (typeof a.title === "string") patch.title = str(a.title);
      if (typeof a.notes === "string") patch.notes = a.notes;
      if (typeof a.due_date === "string") patch.due_date = str(a.due_date) || null;
      if (typeof a.done === "boolean") Object.assign(patch, { done: a.done, done_at: a.done ? new Date().toISOString() : null });
      if (str(a.category)) {
        const t = check(await sb.from("tasks").select("list_id").eq("id", id).single());
        patch.category_id = (await resolveCategory(sb, t.list_id, str(a.category))).id;
      }
      return check(await sb.from("tasks").update(patch).eq("id", id).select("id, title, done, due_date").single());
    }

    case "complete_task": {
      let id = str(a.task_id);
      if (!id) {
        const title = str(a.title);
        const hits = check(await sb.from("tasks").select("id, title").eq("done", false).ilike("title", `%${title}%`));
        if (hits.length !== 1) throw new Error(hits.length ? `Several tasks match: ${hits.map((h) => `${h.title} (${h.id})`).join("; ")}` : `No open task matches "${title}".`);
        id = hits[0].id;
      }
      return check(await sb.from("tasks").update({ done: true, done_at: new Date().toISOString() }).eq("id", id).select("id, title").single());
    }

    case "add_checkpoint": {
      const task_id = str(a.task_id);
      return check(
        await sb
          .from("checkpoints")
          .insert({ task_id, title: str(a.title), position: await nextPosition(sb, "checkpoints", "task_id", task_id) })
          .select("id, title")
          .single()
      );
    }

    case "set_checkpoint":
      return check(await sb.from("checkpoints").update({ done: a.done !== false }).eq("id", str(a.checkpoint_id)).select("id, title, done").single());

    case "create_category": {
      const list = await resolveList(sb, str(a.list));
      return check(
        await sb
          .from("categories")
          .insert({ list_id: list.id, name: str(a.name), description: str(a.description), position: await nextPosition(sb, "categories", "list_id", list.id) })
          .select("id, name")
          .single()
      );
    }

    case "create_list": {
      const kind = str(a.kind) === "business" ? "business" : "personal";
      const existing = check(await sb.from("lists").select("position").order("position", { ascending: false }).limit(1));
      return check(
        await sb
          .from("lists")
          .insert({ name: str(a.name), kind, description: str(a.description), position: (existing[0]?.position ?? 0) + 1 })
          .select("id, name, kind")
          .single()
      );
    }

    case "search_email":
      return listThreads(userId, sb, { folder: "any", q: str(a.query), max: Math.min(Number(a.max) || 15, 30) });

    case "read_email": {
      const t = await getThread(userId, sb, str(a.thread_id));
      return {
        subject: t.subject,
        messages: t.messages.map((m) => ({ from: m.from, to: m.to, date: m.date, text: m.text.slice(0, 8000) })),
      };
    }

    case "send_email": {
      let reply: { inReplyTo?: string; references?: string } = {};
      if (str(a.thread_id)) {
        const last = (await getThread(userId, sb, str(a.thread_id))).messages.at(-1);
        reply = { inReplyTo: last?.messageId, references: last?.references };
      }
      return sendMail(userId, sb, {
        to: str(a.to),
        cc: str(a.cc),
        subject: str(a.subject),
        body: String(a.body ?? ""),
        threadId: str(a.thread_id) || undefined,
        ...reply,
      });
    }

    case "list_events":
      return listEvents(userId, sb, str(a.from), str(a.to));

    case "create_event": {
      const tz = (await account(sb))?.time_zone;
      return createEvent(userId, sb, {
        title: str(a.title),
        start: str(a.start),
        end: str(a.end),
        allDay: a.all_day === true,
        description: str(a.description),
        location: str(a.location),
        timeZone: tz,
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
