"use client";

import { useState } from "react";
import { CalendarBlank, CheckSquare, Plus, Trash, X } from "@phosphor-icons/react";
import { addCheckpoint, deleteCheckpoint, deleteTask, doneFields, localDate, updateCheckpoint, updateTask, type TaskWithSteps } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { Checkpoint } from "@/lib/types";
import { IconButton, Input, Tick, cx, toast } from "./ui";
import { ListDot, tabColor } from "./ListDot";

export function dueLabel(due: string | null) {
  if (!due) return null;
  const today = localDate();
  const tomorrow = localDate(new Date(Date.now() + 86_400_000));
  if (due === today) return { text: "Today", tone: "today" as const };
  if (due === tomorrow) return { text: "Tomorrow", tone: "soon" as const };
  const d = new Date(`${due}T00:00:00`);
  const text = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return { text, tone: due < today ? ("late" as const) : ("later" as const) };
}

/**
 * One task. Tick to complete, click the row to open it in place:
 * notes, due date and checkpoints edit inline, no modal.
 */
export function TaskRow({
  task,
  onChange,
  showList,
}: {
  task: TaskWithSteps;
  onChange: (t: TaskWithSteps | null) => void;
  showList?: boolean;
}) {
  const { lists, touchTasks } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [newStep, setNewStep] = useState("");
  const list = lists.find((l) => l.id === task.list_id);
  const color = tabColor(list?.color ?? "ink");
  const due = dueLabel(task.due_date);
  const doneSteps = task.checkpoints.filter((c) => c.done).length;

  async function save(patch: Partial<TaskWithSteps>) {
    onChange({ ...task, ...patch });
    try {
      const { checkpoints: _, ...rest } = patch;
      await updateTask(task.id, rest);
      touchTasks();
    } catch (e) {
      onChange(task);
      toast(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function toggle() {
    await save(doneFields(!task.done));
  }

  async function setSteps(next: Checkpoint[]) {
    onChange({ ...task, checkpoints: next });
  }

  async function addStep() {
    const t = newStep.trim();
    if (!t) return;
    setNewStep("");
    try {
      const cp = await addCheckpoint(task.id, t, (task.checkpoints.at(-1)?.position ?? 0) + 1);
      setSteps([...task.checkpoints, cp]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add checkpoint");
    }
  }

  async function toggleStep(cp: Checkpoint) {
    setSteps(task.checkpoints.map((c) => (c.id === cp.id ? { ...c, done: !c.done } : c)));
    await updateCheckpoint(cp.id, { done: !cp.done }).catch(() => toast("Could not save"));
  }

  async function removeStep(cp: Checkpoint) {
    setSteps(task.checkpoints.filter((c) => c.id !== cp.id));
    await deleteCheckpoint(cp.id).catch(() => toast("Could not delete"));
  }

  async function remove() {
    onChange(null);
    try {
      await deleteTask(task.id);
      touchTasks();
      toast("Task deleted");
    } catch {
      onChange(task);
    }
  }

  return (
    <li className={cx("task-row group rounded-xl", open && "is-open", task.done && "is-done")} style={{ "--tone": color } as React.CSSProperties}>
      <div className="flex min-h-11 items-start gap-1.5 px-1.5 py-1.5">
        <Tick on={task.done} onChange={toggle} label={task.done ? "Mark as not done" : "Mark as done"} color={color} />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-w-0 flex-1 py-1 text-left">
          <span className={cx("block text-[15px] leading-snug transition-colors duration-200 md:text-sm", task.done ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}>
            {task.title}
          </span>
          {(due || task.checkpoints.length || (showList && list) || task.notes) && !open ? (
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
              {showList && list ? (
                <span className="chip" style={{ "--tone": color } as React.CSSProperties}>
                  <ListDot color={list.color} size={7} />
                  {list.name}
                </span>
              ) : null}
              {due && !task.done ? (
                <span className={cx("chip", `chip-${due.tone}`)}>
                  <CalendarBlank size={12} weight="bold" />
                  {due.tone === "late" ? `Overdue, ${due.text}` : due.text}
                </span>
              ) : null}
              {task.checkpoints.length ? (
                <span
                  className={cx("chip tnum", doneSteps === task.checkpoints.length && "chip-done")}
                  style={{ "--tone": color } as React.CSSProperties}
                  title={`${doneSteps} of ${task.checkpoints.length} checkpoints done`}
                >
                  <CheckSquare size={12} weight="bold" />
                  {doneSteps}/{task.checkpoints.length}
                </span>
              ) : null}
              {task.notes ? <span className="ml-0.5 max-w-[36ch] truncate">{task.notes}</span> : null}
            </span>
          ) : null}
        </button>
        {task.done && !open ? (
          <IconButton label="Delete task" onClick={remove} className="mt-0.5 size-9 text-ink-3 hover:bg-danger-soft hover:text-danger">
            <Trash size={16} />
          </IconButton>
        ) : null}
      </div>

      {open ? (
        <div className="anim-fade grid gap-3 pr-3 pb-3 pl-[42px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Title"
            className="w-full rounded-md bg-transparent text-[15px] font-medium text-ink focus:outline-none md:text-sm"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== task.notes && save({ notes })}
            rows={Math.min(6, Math.max(2, notes.split("\n").length))}
            placeholder="Notes"
            aria-label="Notes"
            className="w-full resize-none rounded-lg border border-rule bg-page px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />

          <div>
            <p className="mb-1 text-xs font-medium text-ink-3">
              Checkpoints{task.checkpoints.length ? <span className="tnum"> · {doneSteps} of {task.checkpoints.length}</span> : null}
            </p>
            <ul className="grid">
              {task.checkpoints.map((cp) => (
                <li key={cp.id} className="group/step flex items-center gap-1">
                  <Tick on={cp.done} onChange={() => toggleStep(cp)} label={cp.title} color={color} size={16} />
                  <span className={cx("flex-1 text-sm", cp.done ? "text-ink-3 line-through" : "text-ink-2")}>{cp.title}</span>
                  <IconButton label="Remove checkpoint" onClick={() => removeStep(cp)} className="hover-only size-7 opacity-0 group-hover/step:opacity-100 focus:opacity-100">
                    <X size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center gap-1">
              <span className="inline-flex size-6 items-center justify-center text-ink-3">
                <Plus size={14} />
              </span>
              <input
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStep())}
                onBlur={addStep}
                placeholder="Add a checkpoint"
                aria-label="New checkpoint"
                className="h-8 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="inline-flex items-center gap-2 text-[13px] text-ink-3">
              Due
              <Input
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => save({ due_date: e.target.value || null })}
                className="h-8 w-auto"
              />
            </label>
            {/* Destructive action kept apart from everything else. */}
            <button onClick={remove} className="press ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-3 hover:bg-danger-soft hover:text-danger">
              <Trash size={14} />
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
