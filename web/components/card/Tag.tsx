import { cn } from "@/lib/utils";

const VARIANT = {
  /** Neutral subtle outline pill */
  outline: "border border-line bg-page text-fg-2",
  /** Soft neutral metadata pill (Lime default) */
  quiet: "border border-transparent bg-surface-2 text-fg-2",
  /** Dark solid pill */
  solid: "border border-transparent bg-primary text-on-accent",
  /** Vermelho Avenza soft wash — #1 best pick & featured badges */
  brand: "border border-brand-border bg-brand-wash text-brand-accent",
  /** Alias kept for backward compatibility */
  mark: "border border-brand-border bg-brand-wash text-brand-accent",
  /** Emerald tint — positive return & fee waivers */
  positive: "border border-transparent bg-success-tint text-success-text",
  /** Amber tint — partial waiver / attention */
  warn: "border border-transparent bg-warn-tint text-warn-text",
  /** Coral tint — ineligible / negative cost */
  negative: "border border-transparent bg-danger-tint text-danger-text",
  /** Petrol teal tint — current card / neutral state */
  info: "border border-transparent bg-info-tint text-info-text",
} as const;

/** Sentence-case Lime pill badge. Never clickable (use Button/Chip for toggles). */
export function Tag({
  children,
  variant = "quiet",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANT;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium tracking-[0.01em]",
        VARIANT[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
