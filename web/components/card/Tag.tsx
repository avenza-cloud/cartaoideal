import { cn } from "@/lib/utils";

const VARIANT = {
  /** Neutral fact: segment, network, issuer. */
  outline: "border-border text-foreground",
  quiet: "border-transparent bg-muted text-muted-foreground",
  solid: "border-foreground bg-foreground text-background",
  positive: "border-positive text-positive",
  negative: "border-negative text-negative",
  mark: "border-mark bg-mark text-mark-foreground",
} as const;

/** Square mono tag. Colour only for gain, cost, or the single best pick. */
export function Tag({
  children,
  variant = "outline",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANT;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-2xs font-medium",
        VARIANT[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
