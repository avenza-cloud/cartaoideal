import { cn } from "@/lib/utils";

interface LeadFactProps {
  /** The number that decides, already formatted (e.g. "R$ 84/mês"). */
  value: string;
  /** Plain sentence-case label saying what the number is. */
  label: string;
  /** Small secondary text beside the label (e.g. the range). */
  hint?: string;
  /** Highlight: this is the best value in its set. */
  marked?: boolean;
  tone?: "default" | "positive" | "negative";
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
  className?: string;
}

const SIZE = {
  sm: "text-base font-medium",
  md: "text-xl font-medium",
  lg: "text-3xl font-medium tracking-[-0.02em]",
} as const;

/**
 * The single loudest element on a card surface. The yellow mark goes behind
 * the number only, and only when it is the best in its set.
 */
export function LeadFact({
  value,
  label,
  hint,
  marked = false,
  tone = "default",
  size = "md",
  align = "left",
  className,
}: LeadFactProps) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right", className)}>
      <p className={cn("num whitespace-nowrap", SIZE[size])}>
        <span
          className={cn(
            marked && "bg-mark px-1 text-mark-foreground",
            !marked && tone === "positive" && "text-positive",
            !marked && tone === "negative" && "text-negative"
          )}
        >
          {value}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {label}
        {hint && (
          <>
            {" "}
            <span className="num whitespace-nowrap">({hint})</span>
          </>
        )}
      </p>
    </div>
  );
}
