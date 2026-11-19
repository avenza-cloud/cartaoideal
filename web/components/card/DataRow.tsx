import { cn } from "@/lib/utils";

/** Label left, value right, subtle hairline under. For clean ledger lists of card facts. */
export function DataRow({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-line py-2.5 last:border-b-0", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="shrink-0 text-sm text-fg-2">{label}</span>
        <span
          className="num min-w-0 truncate text-right text-sm font-semibold text-fg"
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </span>
      </div>
      {detail && <p className="mt-1 text-xs leading-relaxed text-fg-3">{detail}</p>}
    </div>
  );
}

/** Label above a full-width, wrapping value. */
export function FullTextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line py-2.5 last:border-b-0">
      <span className="text-xs font-medium text-fg-3">{label}</span>
      <p className="mt-1 text-sm leading-relaxed text-fg">{value}</p>
    </div>
  );
}

/** Titled editorial ledger section (earned surface: whitespace + hairlines, no heavy outer box). */
export function Block({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pt-1", className)}>
      <h2 className="mb-2 text-lg font-semibold tracking-tight text-fg">{title}</h2>
      <div className="border-t border-line">{children}</div>
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="py-2.5 text-sm text-fg-3">{children}</p>;
}
