import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  /** Subtle wave animation for genuine loading / assistant thinking states. */
  animated?: boolean;
  /** Render all dots in currentColor (no accent). */
  mono?: boolean;
}

/** Cartão Ideal mark from avenza-brand (299→1: rows of three, two, one; accent dot last). */
const DOTS: Array<{ cx: number; cy: number; accent?: boolean }> = [
  { cx: 32.22, cy: 14.94 },
  { cx: 68.22, cy: 14.94 },
  { cx: 104.22, cy: 14.94 },
  { cx: 41.58, cy: 50.94 },
  { cx: 77.58, cy: 50.94 },
  { cx: 50.94, cy: 86.94, accent: true },
];

export function BrandMark({ className, animated = false, mono = false }: BrandMarkProps) {
  return (
    <svg
      viewBox="-4 -4 127.16 109.88"
      role="img"
      aria-label="Cartão Ideal"
      data-testid="brand-mark"
      className={cn("shrink-0", animated && "avenza-dot-loading", className)}
    >
      {DOTS.map(({ cx, cy, accent }) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={14.94}
          className={cn(accent && !mono ? "fill-brand" : mono ? "fill-current" : "fill-fg")}
        />
      ))}
    </svg>
  );
}
