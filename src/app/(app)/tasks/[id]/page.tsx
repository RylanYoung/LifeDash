"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DotsThree, GearSix, Plus, Trash } from "@phosphor-icons/react";
import { KindPicker } from "@/components/Kind";
import Link from "next/link";
import { TaskRow } from "@/components/TaskRow";
import { tabColor } from "@/components/ListDot";
import { Button, ErrorNote, IconButton, Input, Rows, cx, toast } from "@/components/ui";
import { createCategory, createTask, deleteCategory, deleteList, loadTasks, updateCategory, updateList, type TaskWithSteps } from "@/lib/data";
import { useStore } from "@/lib/store";
import { LIST_COLORS, type Category } from "@/lib/types";

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lists, categories, refresh, taskVersion, touchTasks } = useStore();
  const list = lists.find((l) => l.id === id);
  const cats = useMemo(() => categories.filter((c) => c.list_id === id), [categories, id]);
  const [tasks, setTasks] = useState<TaskWithSteps[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [menu, setMenu] = useState(false);

  const load = useCallback(() => {
    setError(null);
    loadTasks(id).then(setTasks).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load, taskVersion]);

  const replace = (t: TaskWithSteps, next: TaskWithSteps | null) =>
    setTasks((all) => (next ? all!.map((x) => (x.id === t.id ? next : x)) : all!.filter((x) => x.id !== t.id)));

  if (!list) {
    return lists.length ? (
      <div className="px-4 py-16 text-center text-sm text-ink-3 md:px-8">
        That list no longer exists.{" "}
        <Link href="/tasks" className="font-medium text-accent">
          All lists
        </Link>
      </div>
    ) : (
      <div className="px-4 py-10 md:px-8">
        <Rows n={5} />
      </div>
    );
  }

  const open = tasks?.filter((t) => !t.done) ?? [];
  const done = tasks?.filter((t) => t.done) ?? [];
  const visible = showDone ? tasks ?? [] : open;
  const loose = visible.filter((t) => !t.category_id || !cats.some((c) => c.id === t.category_id));

  async function patchList(patch: Parameters<typeof updateList>[1]) {
    try {
      await updateList(list!.id, patch);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function removeList() {
    if (!confirm(`Delete "${list!.name}" and all ${tasks?.length ?? 0} of its tasks? This can't be undone.`)) return;
    await deleteList(list!.id);
    await refresh();
    touchTasks();
    router.push("/tasks");
  }

  return (
    <>
      <title>{`${list.name} · LifeDash`}</title>
      <header className="px-4 pt-6 pb-2 md:px-8 md:pt-8">
        <div className="flex items-start gap-3">
          <span className="mt-2.5 inline-block size-3 shrink-0 rounded-[4px]" style={{ background: tabColor(list.color) }} />
          <div className="min-w-0 flex-1">
            <EditableText
              key={`n-${list.id}`}
              value={list.name}
              onSave={(name) => name && patchList({ name })}
              className="w-full bg-transparent text-2xl font-semibold tracking-[-0.02em] md:text-[26px]"
              label="List name"
            />
            <EditableText
              key={`d-${list.id}`}
              value={list.description}
              placeholder="Add a description"
              onSave={(description) => patchList({ description })}
              className="mt-0.5 w-full bg-transparent text-sm text-ink-3 placeholder:text-ink-3/70"
              label="List description"
            />
          </div>
          <div className="relative">
            <IconButton label="List options" onClick={() => setMenu(!menu)} aria-expanded={menu}>
              <DotsThree size={20} weight="bold" />
            </IconButton>
            <Link href="/settings" className="press inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-sunk md:hidden" aria-label="Settings">
              <GearSix size={18} />
            </Link>
            {menu ? (
              <div className="anim-pop absolute right-0 z-20 mt-1 grid w-[300px] gap-4 rounded-xl border border-rule bg-page p-4 shadow-float">
                <KindPicker value={list.kind} onChange={(kind) => patchList({ kind })} />
                <div>
                  <p className="mb-2 text-xs font-medium text-ink-3">Colour</p>
                  <div className="flex gap-2">
                    {LIST_COLORS.map((c) => (
                      <button
                        key={c}
                        aria-label={c}
                        onClick={() => patchList({ color: c })}
                        className={cx("press size-7 rounded-md ring-offset-2 ring-offset-page", list.color === c && "ring-2 ring-ink")}
                        style={{ background: tabColor(c) }}
                      />
                    ))}
                  </div>
                </div>
                <div className="border-t border-rule pt-3">
                  <button onClick={removeList} className="press inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-danger hover:bg-danger-soft">
                    <Trash size={14} />
                    Delete list
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-xs text-ink-3">
          <span className="tnum">
            {open.length} open{done.length ? `, ${done.length} done` : ""}
          </span>
          <span>{list.kind === "business" ? "Business: Claude reads this list as context" : "Personal: kept out of Claude's context"}</span>
          {done.length ? (
            <button className="font-medium text-ink-2 hover:text-ink" onClick={() => setShowDone(!showDone)}>
              {showDone ? "Hide completed" : "Show completed"}
            </button>
          ) : null}
        </p>
      </header>

      <div className="grid max-w-3xl gap-6 px-4 pt-4 pb-16 md:px-8">
        {error ? <ErrorNote message={error} onRetry={load} /> : null}
        {!tasks ? (
          <Rows n={5} />
        ) : (
          <>
            {loose.length || !cats.length ? (
              <section>
                <ul className="-mx-1.5 grid">
                  {loose.map((t) => (
                    <TaskRow key={t.id} task={t} onChange={(n) => replace(t, n)} />
                  ))}
                </ul>
                <AddTask listId={list.id} categoryId={null} onAdd={(t) => setTasks((a) => [...a!, t])} />
              </section>
            ) : null}

            {cats.map((c) => (
              <CategorySection
                key={c.id}
                category={c}
                tasks={visible.filter((t) => t.category_id === c.id)}
                onTask={replace}
                onAdd={(t) => setTasks((a) => [...a!, t])}
              />
            ))}

            <NewCategory listId={list.id} position={(cats.at(-1)?.position ?? 0) + 1} first={!cats.length} />
          </>
        )}
      </div>
    </>
  );
}

function CategorySection({
  category,
  tasks,
  onTask,
  onAdd,
}: {
  category: Category;
  tasks: TaskWithSteps[];
  onTask: (t: TaskWithSteps, n: TaskWithSteps | null) => void;
  onAdd: (t: TaskWithSteps) => void;
}) {
  const { refresh } = useStore();
  const save = async (patch: Partial<Category>) => {
    await updateCategory(category.id, patch).catch(() => toast("Could not save"));
    await refresh();
  };
  async function remove() {
    if (!confirm(`Delete the "${category.name}" category? Its tasks stay in the list, uncategorised.`)) return;
    await deleteCategory(category.id);
    await refresh();
  }
  return (
    <section className="group/cat">
      <div className="flex items-start gap-2 border-b border-rule pb-2">
        <div className="min-w-0 flex-1">
          <EditableText value={category.name} onSave={(name) => name && save({ name })} className="w-full bg-transparent text-[15px] font-semibold" label="Category name" />
          <EditableText
            value={category.description}
            placeholder="What belongs here?"
            onSave={(description) => save({ description })}
            className="w-full bg-transparent text-[13px] text-ink-3 placeholder:text-ink-3/70"
            label="Category description"
          />
        </div>
        <span className="pt-1 text-xs text-ink-3 tnum">{tasks.filter((t) => !t.done).length}</span>
        <IconButton label="Delete category" onClick={remove} className="hover-only size-7 opacity-0 group-hover/cat:opacity-100 focus:opacity-100">
          <Trash size={14} />
        </IconButton>
      </div>
      <ul className="-mx-1.5 mt-1 grid">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onChange={(n) => onTask(t, n)} />
        ))}
      </ul>
      <AddTask listId={category.list_id} categoryId={category.id} onAdd={onAdd} />
    </section>
  );
}

function AddTask({ listId, categoryId, onAdd }: { listId: string; categoryId: string | null; onAdd: (t: TaskWithSteps) => void }) {
  const { touchTasks } = useStore();
  const [title, setTitle] = useState("");
  async function add() {
    const t = title.trim();
    if (!t) return;
    setTitle("");
    try {
      const task = await createTask({ list_id: listId, category_id: categoryId, title: t });
      onAdd({ ...task, checkpoints: [] });
      touchTasks();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add the task");
    }
  }
  return (
    <div className="flex items-center gap-1.5 px-1.5">
      <span className="inline-flex size-7 items-center justify-center text-ink-3">
        <Plus size={15} />
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="Add a task"
        aria-label="Add a task"
        className="h-10 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none md:text-sm"
      />
      {title.trim() ? (
        <Button size="sm" variant="primary" onClick={add}>
          Add
        </Button>
      ) : null}
    </div>
  );
}

function NewCategory({ listId, position, first }: { listId: string; position: number; first: boolean }) {
  const { refresh } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createCategory({ list_id: listId, name: name.trim(), description: description.trim(), position });
      await refresh();
      setName("");
      setDescription("");
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add the category");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="press flex h-11 items-center gap-2 rounded-xl border border-dashed border-rule-strong px-4 text-sm text-ink-2 hover:border-ink-3 hover:text-ink"
      >
        <Plus size={15} />
        {first ? "Group tasks into a category" : "New category"}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="anim-pop grid gap-2.5 rounded-xl border border-rule bg-page p-4">
      <Input autoFocus placeholder="Category name, e.g. Outreach" value={name} onChange={(e) => setName(e.target.value)} aria-label="Category name" />
      <Input placeholder="Description: what belongs here" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Category description" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()}>
          Add category
        </Button>
      </div>
    </form>
  );
}

/** Text that is its own editor: looks like a heading, edits in place, saves on blur or Enter. */
function EditableText({ value, onSave, className, placeholder, label }: { value: string; onSave: (v: string) => void; className: string; placeholder?: string; label: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onSave(v.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setV(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cx("rounded-md text-ink hover:bg-sunk/60 focus:bg-sunk/60 focus:outline-none", className)}
    />
  );
}
