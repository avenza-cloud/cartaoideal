import { cn } from "@/lib/utils";
import { CARTAO_IDEAL_DOTS, CARTAO_IDEAL_MARK_VIEW_BOX } from "@/lib/cartao-ideal-mark";

interface BrandMarkProps {
  className?: string;
  /** Subtle wave animation for genuine loading / assistant thinking states. */
  animated?: boolean;
  /** Render all dots in currentColor (no accent). */
  mono?: boolean;
}

export function BrandMark({ className, animated = false, mono = false }: BrandMarkProps) {
  return (
    <svg
      viewBox={CARTAO_IDEAL_MARK_VIEW_BOX}
      role="img"
      aria-label="Cartão Ideal"
      data-testid="brand-mark"
      className={cn("shrink-0", animated && "avenza-dot-loading", className)}
    >
      {CARTAO_IDEAL_DOTS.map(({ cx, cy, accent }) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={14.94}
          className={cn(accent && !mono ? "fill-ci-accent" : mono ? "fill-current" : "fill-fg")}
        />
      ))}
    </svg>
  );
}
