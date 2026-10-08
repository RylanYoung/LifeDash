export type ListKind = "business" | "personal";

export type List = {
  id: string;
  name: string;
  description: string;
  kind: ListKind;
  color: string;
  position: number;
};

export type Category = {
  id: string;
  list_id: string;
  name: string;
  description: string;
  position: number;
};

export type Task = {
  id: string;
  list_id: string;
  category_id: string | null;
  title: string;
  notes: string;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  position: number;
  created_at: string;
};

export type Checkpoint = {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
};

export type Brief = {
  id: string;
  kind: "morning" | "recap";
  for_date: string;
  content: string;
  created_at: string;
};

export type ContextNote = { id: string; title: string; body: string; position: number; updated_at: string };
export type ContextFact = { id: string; fact: string; source: string; created_at: string };

export type MailSummary = {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  date: string;
  snippet: string;
  unread: boolean;
  starred: boolean;
  count: number;
};

export type MailMessage = {
  id: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  messageId: string;
  references: string;
  html: string | null;
  text: string;
};

export type MailThread = { id: string; subject: string; messages: MailMessage[] };

export type CalEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string; // ISO datetime, or YYYY-MM-DD when allDay
  end: string;
  allDay: boolean;
  link: string;
  meet: string;
};

/** Planner tab colours. Keys are stored on the list; values live in CSS tokens. */
export const LIST_COLORS = ["ink", "moss", "ochre", "rose", "slate", "plum"] as const;
