import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "muted";
}

const TONE = {
  default: "text-fg",
  positive: "text-success-text",
  negative: "text-danger-text",
  muted: "text-fg-3",
} as const;

/**
 * Hairline-bounded inline metric strip (zero nested card borders).
 * Fixed column order lets the eye scan Anuidade, Retorno, Sala VIP effortlessly.
 */
export function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cn("grid gap-x-3 gap-y-2 border-y border-line py-2.5", className)}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0">
          <dt className="truncate text-xs text-fg-3">{stat.label}</dt>
          <dd
            className={cn(
              "num mt-0.5 truncate text-sm font-semibold",
              TONE[stat.tone ?? "default"]
            )}
            title={stat.value}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
