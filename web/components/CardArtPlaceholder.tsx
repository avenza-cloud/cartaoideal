import { issuerInitials } from "@/lib/card-display";
import { cn } from "@/lib/utils";

interface CardArtPlaceholderProps {
  issuerRaw: string;
  network?: string;
  displayName?: string;
  className?: string;
  /** Small list-row variant: fills the slot, initials only. */
  compact?: boolean;
}

/**
 * Stand-in when a card has no official art: issuer initials on a flat mono
 * tile. Prefer `CardArt` from `@/components/card`, which handles both cases.
 */
export function CardArtPlaceholder({
  issuerRaw,
  network,
  displayName,
  className,
  compact = false,
}: CardArtPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={displayName ? `Cartão ${displayName}` : `Cartão ${issuerRaw}`}
      className={cn(
        "flex items-center justify-center rounded-md border bg-muted",
        compact ? "h-full w-full" : "aspect-[1.586] h-full max-h-24",
        className
      )}
    >
      <div className="flex flex-col items-center gap-0.5 px-2">
        <span className={cn("font-medium text-foreground", compact ? "text-2xs" : "text-xl")}>
          {issuerInitials(issuerRaw)}
        </span>
        {!compact && network && <span className="text-2xs text-muted-foreground">{network}</span>}
      </div>
    </div>
  );
}
