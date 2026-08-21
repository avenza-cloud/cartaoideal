import { issuerInitials, networkGradientClass } from "@/lib/card-display";
import { cn } from "@/lib/utils";
import type { CardFacet } from "@/types/cards";

interface CardArtPlaceholderProps {
  issuerRaw: string;
  network: CardFacet["network_primary"];
  displayName?: string;
  className?: string;
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
}: CardArtPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={displayName ? `Cartão ${displayName}` : `Cartão ${issuerRaw}`}
      className={cn(
        "flex aspect-[1.586] h-full max-h-24 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br shadow-inner",
        networkGradientClass(network),
        className
      )}
    >
      <div className="flex flex-col items-center gap-0.5 px-2">
        <span className="font-mono text-lg font-bold tracking-widest text-white/80">
          {issuerInitials(issuerRaw)}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-white/50">{network}</span>
      </div>
    </div>
  );
}
