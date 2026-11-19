import { cardArtSrc, issuerInitials } from "@/lib/card-display";
import { cn } from "@/lib/utils";

interface CardArtProps {
  artUrl?: string | null;
  issuerRaw: string;
  network?: string;
  displayName?: string;
  /** Outer well classes: set the size here (e.g. "h-10 w-16"). */
  className?: string;
  /** Small rows show initials only when there is no art. */
  compact?: boolean;
  loading?: "eager" | "lazy";
}

/**
 * Physical credit card framing: realistic 1.586:1 ISO proportion with quiet surface
 * fallback and subtle paper lift (never a heavy grey bordered box).
 */
export function CardArt({
  artUrl,
  issuerRaw,
  network,
  displayName,
  className,
  compact = false,
  loading = "lazy",
}: CardArtProps) {
  const src = cardArtSrc(artUrl);
  const label = displayName ? `Cartão ${displayName}` : `Cartão ${issuerRaw}`;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-surface-2",
        compact
          ? "rounded-[6px] shadow-[0_1px_3px_rgb(var(--shadow-ink)/0.12),0_0_0_1px_rgb(var(--shadow-ink)/0.06)]"
          : "rounded-[10px] shadow-paper",
        className
      )}
    >
      {src ? (
        <img src={src} alt={label} loading={loading} className="h-full w-full object-contain" />
      ) : (
        <div
          role="img"
          aria-label={label}
          className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-center"
        >
          <span className={cn("font-semibold text-fg", compact ? "text-xs" : "text-xl")}>
            {issuerInitials(issuerRaw)}
          </span>
          {!compact && network && <span className="text-xs text-fg-3">{network}</span>}
        </div>
      )}
    </div>
  );
}
