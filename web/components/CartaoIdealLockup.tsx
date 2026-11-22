import { cn } from "@/lib/utils";
import { CARTAO_IDEAL_DOTS, CARTAO_IDEAL_LOCKUP_VIEW_BOX } from "@/lib/cartao-ideal-mark";
import { CARTAO_IDEAL_WORDMARK_PATH } from "@/lib/cartao-ideal-wordmark-path";

type CartaoIdealLockupProps = {
  className?: string;
};

/** Full lockup: mark + outlined wordmark; ink follows `--fg`, accent follows `--ci-accent`. */
export function CartaoIdealLockup({ className }: CartaoIdealLockupProps) {
  return (
    <svg
      viewBox={CARTAO_IDEAL_LOCKUP_VIEW_BOX}
      role="img"
      aria-label="Cartão Ideal"
      className={cn("h-[22px] w-auto shrink-0 select-none", className)}
    >
      {CARTAO_IDEAL_DOTS.map(({ cx, cy, accent }) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={14.94}
          className={accent ? "fill-ci-accent" : "fill-fg"}
        />
      ))}
      <path d={CARTAO_IDEAL_WORDMARK_PATH} className="fill-fg" />
    </svg>
  );
}
