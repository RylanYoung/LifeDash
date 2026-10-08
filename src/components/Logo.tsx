/* eslint-disable @next/next/no-img-element */
import { cx } from "./ui";

/** Solven Growth wordmark: black on light, white on dark. Source images are 727x241. */
export function Logo({ height = 22, className }: { height?: number; className?: string }) {
  const width = Math.round((height * 727) / 241);
  return (
    <span className={cx("inline-flex shrink-0", className)} style={{ height, width }}>
      <img src="/brand/solven-black.png" alt="Solven Growth" width={width} height={height} className="block dark:hidden" />
      <img src="/brand/solven-white.png" alt="" aria-hidden width={width} height={height} className="hidden dark:block" />
    </span>
  );
}
