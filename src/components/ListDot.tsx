/** The list's planner-tab colour as a small square tab. */
export function ListDot({ color, size = 9 }: { color: string; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-[3px]" style={{ width: size, height: size, background: `var(--tab-${color}, var(--tab-ink))` }} />;
}

export const tabColor = (color: string) => `var(--tab-${color}, var(--tab-ink))`;
