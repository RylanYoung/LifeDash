"use client";

import { supabase } from "./supabase";
import type { Brief, Category, Checkpoint, ContextFact, ContextNote, List, Task } from "./types";

/** Thin, typed wrappers over Supabase. Row-level security scopes every call to the signed-in user. */

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export type TaskWithSteps = Task & { checkpoints: Checkpoint[] };

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* lists + categories */

export async function loadLists() {
  return must(await supabase().from("lists").select("*").order("position")) as List[];
}

export async function loadCategories() {
  return must(await supabase().from("categories").select("*").order("position")) as Category[];
}

export async function createList(input: Partial<List>) {
  return must(await supabase().from("lists").insert(input).select().single()) as List;
}

export async function updateList(id: string, patch: Partial<List>) {
  must(await supabase().from("lists").update(patch).eq("id", id));
}

export async function deleteList(id: string) {
  must(await supabase().from("lists").delete().eq("id", id));
}

export async function createCategory(input: Partial<Category>) {
  return must(await supabase().from("categories").insert(input).select().single()) as Category;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  must(await supabase().from("categories").update(patch).eq("id", id));
}

export async function deleteCategory(id: string) {
  must(await supabase().from("categories").delete().eq("id", id));
}

/** First run: give the owner their two starting lists. */
let seeding: Promise<List[]> | null = null;
export function seedIfEmpty(lists: List[]): Promise<List[]> {
  if (lists.length) return Promise.resolve(lists);
  return (seeding ??= seed());
}

async function seed() {
  must(
    await supabase()
      .from("lists")
      .insert([
        { name: "Solven Growth", kind: "business", color: "green", position: 1, description: "Everything that grows the business." },
        { name: "Personal", kind: "personal", color: "moss", position: 2, description: "" },
      ])
  );
  return loadLists();
}

/* tasks */

async function attachSteps(tasks: Task[]): Promise<TaskWithSteps[]> {
  if (!tasks.length) return [];
  const steps = must(
    await supabase().from("checkpoints").select("*").in("task_id", tasks.map((t) => t.id)).order("position")
  ) as Checkpoint[];
  return tasks.map((t) => ({ ...t, checkpoints: steps.filter((s) => s.task_id === t.id) }));
}

export async function loadTasks(listId: string) {
  return attachSteps(must(await supabase().from("tasks").select("*").eq("list_id", listId).order("position")) as Task[]);
}

export async function loadDue(today: string) {
  return attachSteps(
    must(await supabase().from("tasks").select("*").eq("done", false).lte("due_date", today).order("due_date")) as Task[]
  );
}

export async function loadDoneSince(iso: string) {
  return must(await supabase().from("tasks").select("*").eq("done", true).gte("done_at", iso).order("done_at", { ascending: false })) as Task[];
}

export async function createTask(input: Partial<Task>) {
  return must(await supabase().from("tasks").insert({ position: Date.now() / 1000, ...input }).select().single()) as Task;
}

export async function updateTask(id: string, patch: Partial<Task>) {
  must(await supabase().from("tasks").update(patch).eq("id", id));
}

export const doneFields = (done: boolean) => ({ done, done_at: done ? new Date().toISOString() : null });

export async function deleteTask(id: string) {
  must(await supabase().from("tasks").delete().eq("id", id));
}

export async function addCheckpoint(task_id: string, title: string, position: number) {
  return must(await supabase().from("checkpoints").insert({ task_id, title, position }).select().single()) as Checkpoint;
}

export async function updateCheckpoint(id: string, patch: Partial<Checkpoint>) {
  must(await supabase().from("checkpoints").update(patch).eq("id", id));
}

export async function deleteCheckpoint(id: string) {
  must(await supabase().from("checkpoints").delete().eq("id", id));
}

/* briefs + context */

export async function latestBriefs() {
  return must(await supabase().from("briefs").select("*").order("created_at", { ascending: false }).limit(6)) as Brief[];
}

export async function loadNotes() {
  return must(await supabase().from("context_notes").select("*").order("position")) as ContextNote[];
}

export async function saveNote(note: Partial<ContextNote>) {
  const row = { ...note, updated_at: new Date().toISOString() };
  return must(await supabase().from("context_notes").upsert(row).select().single()) as ContextNote;
}

export async function deleteNote(id: string) {
  must(await supabase().from("context_notes").delete().eq("id", id));
}

export async function loadFacts() {
  return must(await supabase().from("context_facts").select("*").order("created_at", { ascending: false })) as ContextFact[];
}

export async function addFact(fact: string) {
  return must(await supabase().from("context_facts").insert({ fact, source: "you" }).select().single()) as ContextFact;
}

export async function deleteFact(id: string) {
  must(await supabase().from("context_facts").delete().eq("id", id));
}
