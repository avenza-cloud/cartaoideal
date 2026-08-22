import { issuerInitials, networkGradientClass } from "@/lib/card-display";
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
 * Branded stand-in rendered whenever a card has no official art
 * (media.card_art_url === "unknown"). Card-shaped, issuer initials over a
 * network-tinted gradient.
 */
export function CardArtPlaceholder({
  issuerRaw,
  network,
  displayName,
  className,
  compact = false,
}: CardArtPlaceholderProps) {
  const gradient = network
    ? networkGradientClass(network)
    : "from-zinc-950 via-zinc-900 to-zinc-800";

  if (compact) {
    return (
      <div
        role="img"
        aria-label={displayName ? `Cartão ${displayName}` : `Cartão ${issuerRaw}`}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-md bg-gradient-to-br",
          gradient,
          className
        )}
      >
        <span className="font-mono text-[11px] font-bold tracking-widest text-white/75">
          {issuerInitials(issuerRaw)}
        </span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={displayName ? `Cartão ${displayName}` : `Cartão ${issuerRaw}`}
      className={cn(
        "flex aspect-[1.586] h-full max-h-24 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br shadow-inner",
        gradient,
        className
      )}
    >
      <div className="flex flex-col items-center gap-0.5 px-2">
        <span className="font-mono text-lg font-bold tracking-widest text-white/80">
          {issuerInitials(issuerRaw)}
        </span>
        {network && (
          <span className="text-[9px] uppercase tracking-wider text-white/50">{network}</span>
        )}
      </div>
    </div>
  );
}
