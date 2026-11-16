import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "muted";
}

const TONE = {
  default: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
  muted: "text-muted-foreground",
} as const;

/**
 * Fixed row of facts in the same order everywhere (fee, return, lounge...),
 * so the eye learns where each one lives. Cells are divided by hairlines.
 */
export function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cn("grid divide-x overflow-hidden rounded-md border bg-card", className)}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 px-2.5 py-2">
          <dt className="truncate text-2xs text-muted-foreground">{stat.label}</dt>
          <dd
            className={cn("num mt-0.5 truncate text-sm font-medium", TONE[stat.tone ?? "default"])}
            title={stat.value}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
