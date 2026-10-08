"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { createTask, addCheckpoint, localDate } from "@/lib/data";
import { addDays } from "@/lib/time";
import { Button, Input, Select, toast } from "./ui";

/** Centered capture box. Title first; list, category and date are one tab away. */
export function QuickAdd() {
  const { quickAdd, closeQuickAdd, lists, categories, touchTasks } = useStore();
  const [title, setTitle] = useState("");
  const [listId, setListId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [due, setDue] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!quickAdd.open) return;
    setTitle("");
    setDue("");
    setSteps("");
    setListId(quickAdd.listId ?? lists[0]?.id ?? "");
    setCategoryId(quickAdd.categoryId ?? "");
    requestAnimationFrame(() => input.current?.focus());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeQuickAdd();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickAdd, lists, closeQuickAdd]);

  const cats = useMemo(() => categories.filter((c) => c.list_id === listId), [categories, listId]);

  if (!quickAdd.open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !listId) return;
    setBusy(true);
    try {
      const task = await createTask({ title: title.trim(), list_id: listId, category_id: categoryId || null, due_date: due || null });
      const lines = steps.split("\n").map((s) => s.trim()).filter(Boolean);
      for (const [i, s] of lines.entries()) await addCheckpoint(task.id, s, i + 1);
      touchTasks();
      toast(`Added to ${lists.find((l) => l.id === listId)?.name ?? "list"}`);
      closeQuickAdd();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add the task");
    } finally {
      setBusy(false);
    }
  }

  const today = localDate();
  const tomorrow = localDate(addDays(new Date(), 1));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label="New task">
      <div className="anim-fade absolute inset-0 bg-ink/20 dark:bg-black/50" onClick={closeQuickAdd} />
      <form onSubmit={submit} className="anim-pop relative w-full max-w-[520px] rounded-xl border border-rule bg-page shadow-float">
        <input
          ref={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          aria-label="Task title"
          className="h-14 w-full rounded-t-xl bg-transparent px-5 text-[17px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <div className="grid gap-3 border-t border-rule px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="List" value={listId} onChange={(e) => (setListId(e.target.value), setCategoryId(""))}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-3">Due</span>
            {[
              ["Today", today],
              ["Tomorrow", tomorrow],
            ].map(([label, val]) => (
              <button
                key={label}
                type="button"
                onClick={() => setDue(due === val ? "" : val)}
                className={`press h-8 rounded-full border px-3 text-[13px] ${due === val ? "border-accent bg-accent-soft text-ink" : "border-rule-strong text-ink-2 hover:bg-sunk"}`}
              >
                {label}
              </button>
            ))}
            <Input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-auto" />
          </div>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={2}
            placeholder="Checkpoints, one per line (optional)"
            aria-label="Checkpoints"
            className="w-full resize-none rounded-lg border border-rule bg-sunk/60 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-rule px-5 py-3">
          <span className="mr-auto hidden text-xs text-ink-3 md:inline">Enter to add, Esc to close</span>
          <Button type="button" variant="ghost" onClick={closeQuickAdd}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy} disabled={!title.trim()}>
            Add task
          </Button>
        </div>
      </form>
    </div>
  );
}
