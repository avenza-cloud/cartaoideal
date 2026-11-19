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
  sm: "text-base font-semibold tracking-[-0.01em]",
  md: "text-xl font-semibold tracking-[-0.015em]",
  lg: "text-3xl font-semibold tracking-[-0.025em]",
} as const;

/**
 * The single loudest numeric anchor on a card surface.
 * Uses clean tabular Instrument Sans and semantic positive/negative tones.
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
  const valueTone =
    tone === "negative"
      ? "text-danger-text"
      : tone === "positive" || marked
        ? "text-success-text"
        : "text-fg";

  return (
    <div className={cn("min-w-0", align === "right" && "text-right", className)}>
      <p className={cn("num whitespace-nowrap", SIZE[size], valueTone)}>
        <span>{value}</span>
      </p>
      <p className="mt-0.5 text-xs text-fg-3">
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
