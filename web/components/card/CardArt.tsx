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
 * The one way card art is shown: a flat bordered well. With no official art,
 * issuer initials on a mono tile stand in. No gradients, no shadows.
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
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          loading={loading}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <div
          role="img"
          aria-label={label}
          className="flex h-full w-full flex-col items-center justify-center gap-0.5"
        >
          <span className={cn("font-medium text-foreground", compact ? "text-2xs" : "text-xl")}>
            {issuerInitials(issuerRaw)}
          </span>
          {!compact && network && <span className="text-2xs text-muted-foreground">{network}</span>}
        </div>
      )}
    </div>
  );
}
