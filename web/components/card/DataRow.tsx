import { cn } from "@/lib/utils";

/** Label left, value right, hairline under. For lists of card facts. */
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
    <div className={cn("border-b py-2 last:border-b-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
        <span
          className="num min-w-0 truncate text-right text-sm font-medium"
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </span>
      </div>
      {detail && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>}
    </div>
  );
}

/** Label above a full-width, wrapping value. */
export function FullTextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="mt-0.5 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

/** Titled panel that groups rows on the detail page. */
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
    <section className={cn("rounded-md border bg-card p-4", className)}>
      <h2 className="mb-1 text-sm font-medium">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-xs text-muted-foreground">{children}</p>;
}
