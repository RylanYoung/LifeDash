"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CaretRight, Plus } from "@phosphor-icons/react";
import { KindBadge, KindPicker } from "@/components/Kind";
import { PageHeader } from "@/components/Shell";
import { ListDot } from "@/components/ListDot";
import { Button, Input, cx, toast } from "@/components/ui";
import { createList } from "@/lib/data";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { LIST_COLORS, type ListKind } from "@/lib/types";

export default function TasksIndex() {
  return (
    <Suspense>
      <Index />
    </Suspense>
  );
}

function Index() {
  const { lists, refresh, taskVersion } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [adding, setAdding] = useState(params.get("new") === "1");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (params.get("new") === "1") setAdding(true);
  }, [params]);

  useEffect(() => {
    supabase()
      .from("tasks")
      .select("list_id")
      .eq("done", false)
      .then(({ data }) => {
        const c: Record<string, number> = {};
        for (const r of data ?? []) c[r.list_id] = (c[r.list_id] ?? 0) + 1;
        setCounts(c);
      });
  }, [taskVersion, lists]);

  return (
    <>
      <title>Tasks · LifeDash</title>
      <PageHeader
        title="Tasks"
        sub="Business lists feed Claude's context. Personal lists stay private."
        actions={
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={14} />
            New list
          </Button>
        }
      />
      <div className="grid max-w-3xl gap-3 px-4 pb-10 md:px-8">
        {adding ? (
          <NewList
            onDone={async (id) => {
              setAdding(false);
              if (id) {
                await refresh();
                router.push(`/tasks/${id}`);
              } else router.replace("/tasks");
            }}
          />
        ) : null}
        <ul className="grid overflow-hidden rounded-xl border border-rule bg-page">
          {lists.map((l, i) => (
            <li key={l.id} className={cx(i > 0 && "border-t border-rule")}>
              <Link href={`/tasks/${l.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunk/60 md:px-5">
                <ListDot color={l.color} size={11} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{l.name}</span>
                  {l.description ? <span className="block truncate text-[13px] text-ink-3">{l.description}</span> : null}
                </span>
                <KindBadge kind={l.kind} />
                <span className="w-8 text-right text-sm text-ink-3 tnum">{counts[l.id] ?? 0}</span>
                <CaretRight size={14} className="text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function NewList({ onDone }: { onDone: (id?: string) => void }) {
  const { lists } = useStore();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ListKind>("personal");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const color = LIST_COLORS[lists.length % LIST_COLORS.length];
      const l = await createList({ name: name.trim(), kind, color, position: (lists.at(-1)?.position ?? 0) + 1 });
      onDone(l.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create the list");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="anim-pop grid gap-3 rounded-xl border border-rule bg-page p-4 md:p-5">
      <Input autoFocus placeholder="List name, e.g. Gym, Home, Solven Outreach" value={name} onChange={(e) => setName(e.target.value)} aria-label="List name" />
      <KindPicker value={kind} onChange={setKind} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()}>
          Create list
        </Button>
      </div>
    </form>
  );
}

