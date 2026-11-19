import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  /** Subtle wave animation for genuine loading / assistant thinking states. */
  animated?: boolean;
  /** Render in currentColor instead of Vermelho Avenza (#ff3333). */
  mono?: boolean;
}

/**
 * Genuine Avenza 8-dot leaning 3×3 mark (13.5°).
 * Red (#ff3333) means Avenza; the leaning dots form the A of entries put in order.
 */
export function BrandMark({ className, animated = false, mono = false }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 119.16 101.88"
      role="img"
      aria-label="Avenza — Cartão Ideal"
      data-testid="brand-mark"
      className={cn("shrink-0", animated && "avenza-dot-loading", className)}
    >
      <g className={mono ? "fill-current" : "fill-brand"}>
        <rect x="0" y="72" width="29.88" height="29.88" rx="14.94" />
        <rect x="72" y="72" width="29.88" height="29.88" rx="14.94" />
        <rect x="8.64" y="36" width="29.88" height="29.88" rx="14.94" />
        <rect x="80.64" y="36" width="29.88" height="29.88" rx="14.94" />
        <rect x="44.64" y="36" width="29.88" height="29.88" rx="14.94" />
        <rect x="17.28" y="0" width="29.88" height="29.88" rx="14.94" />
        <rect x="89.28" y="0" width="29.88" height="29.88" rx="14.94" />
        <rect x="53.28" y="0" width="29.88" height="29.88" rx="14.94" />
      </g>
    </svg>
  );
}
