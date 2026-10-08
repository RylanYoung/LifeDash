/** "9:30", or for older items "Tue" / "8 Oct" when relative is set. */
export function fmtTime(iso: string, relative = false) {
  const d = new Date(iso);
  if (relative) {
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (!sameDay) {
      const days = (now.getTime() - d.getTime()) / 86_400_000;
      return days < 6 ? d.toLocaleDateString(undefined, { weekday: "short" }) : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    }
  }
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
