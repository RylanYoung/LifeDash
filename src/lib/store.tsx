"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { api, isConfigured, supabase } from "./supabase";
import { loadCategories, loadLists, seedIfEmpty } from "./data";
import type { Category, List } from "./types";

type Google = { connected: boolean; email: string | null; timeZone: string | null };

type Store = {
  session: Session | null;
  ready: boolean;
  lists: List[];
  categories: Category[];
  google: Google | null;
  refresh: () => Promise<void>;
  refreshGoogle: () => Promise<void>;
  /** Bumped whenever tasks change somewhere, so other views can reload. */
  taskVersion: number;
  touchTasks: () => void;
  quickAdd: { open: boolean; listId?: string; categoryId?: string | null };
  openQuickAdd: (listId?: string, categoryId?: string | null) => void;
  closeQuickAdd: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [lists, setLists] = useState<List[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [google, setGoogle] = useState<Google | null>(null);
  const [taskVersion, setTaskVersion] = useState(0);
  const [quickAdd, setQuickAdd] = useState<Store["quickAdd"]>({ open: false });

  useEffect(() => {
    if (!isConfigured) {
      setReady(true);
      return;
    }
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const [l, c] = await Promise.all([loadLists().then(seedIfEmpty), loadCategories()]);
    setLists(l);
    setCategories(c);
  }, []);

  const refreshGoogle = useCallback(async () => {
    try {
      setGoogle(await api<Google>("/api/google/status"));
    } catch {
      setGoogle({ connected: false, email: null, timeZone: null });
    }
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    refresh().catch(() => {});
    refreshGoogle();
  }, [userId, refresh, refreshGoogle]);

  const value: Store = {
    session,
    ready,
    lists,
    categories,
    google,
    refresh,
    refreshGoogle,
    taskVersion,
    touchTasks: useCallback(() => setTaskVersion((v) => v + 1), []),
    quickAdd,
    openQuickAdd: useCallback((listId?: string, categoryId?: string | null) => setQuickAdd({ open: true, listId, categoryId }), []),
    closeQuickAdd: useCallback(() => setQuickAdd({ open: false }), []),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
