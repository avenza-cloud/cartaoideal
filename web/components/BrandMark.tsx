/** Square mark: a card with its stripe, in the theme's own black and white. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Cartão Ideal"
      data-testid="brand-mark"
      className={className}
    >
      <rect width="24" height="24" rx="4" className="fill-foreground" />
      <rect x="4" y="7" width="16" height="10" rx="1" className="fill-background" />
      <rect x="4" y="9.5" width="16" height="2.5" className="fill-mark" />
    </svg>
  );
}
