import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  className?: string;
  /** Show the parent "por avenza" sub-product lockup (Cognition / Devin pattern). */
  showParent?: boolean;
};

/** Drawn Avenza parent wordmark vector (from avenza-brand/logo/avenza-lockup.svg). */
export function AvenzaParentWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 24 134 22"
      aria-label="Avenza"
      className={cn("h-[9px] w-auto shrink-0 fill-current", className)}
    >
      <path d="M14.9,24.55h3.45v20.96h-3.45v-2.65c-.88,2.1-3.22,2.92-6.33,2.92C2.48,45.78,0,43.19,0,37.77v-5.49C0,26.87,2.27,24.28,8.58,24.28c3.11,0,5.45.82,6.33,2.92v-2.65ZM14.9,32.68c0-4.15-1.68-5.43-5.72-5.43s-5.72,1.28-5.72,5.43v4.69c0,4.16,1.66,5.41,5.72,5.41s5.72-1.26,5.72-5.41v-4.69Z" />
      <path d="M32.72,41.35l-6.38-16.81h-3.6l8.17,20.96h3.62l8.19-20.96h-3.6l-6.4,16.81Z" />
      <path d="M64.1,32.28v3.76h-14.88v1.51c0,3.98,1.66,5.24,5.72,5.24s5.72-1.26,5.72-5.09h3.45c0,5.41-2.25,8.08-9.17,8.08s-9.18-2.59-9.18-8v-5.49c0-5.41,2.4-8,9.18-8s9.17,2.59,9.17,8ZM60.65,32.51c0-3.98-1.68-5.26-5.72-5.26s-5.72,1.28-5.72,5.26v1.18h11.43v-1.18Z" />
      <path d="M79.14,24.28c-3.09,0-5.43.82-6.31,2.92v-2.65h-3.47v20.96h3.47v-12.83c0-4.15,1.66-5.43,5.72-5.43s5.72,1.28,5.72,5.43v12.83h3.45v-13.23c0-5.41-2.27-8-8.58-8Z" />
      <path d="M93.3,27.84h12.96l-12.96,14.37v3.3h17.72v-3.3h-12.96l12.96-14.37v-3.3h-17.72v3.3Z" />
      <path d="M130.53,24.55h3.45v20.96h-3.45v-2.65c-.88,2.1-3.22,2.92-6.33,2.92-6.1,0-8.58-2.59-8.58-8v-5.49c0-5.41,2.27-8,8.58-8,3.11,0,5.45.82,6.33,2.92v-2.65ZM130.53,32.68c0-4.15-1.68-5.43-5.72-5.43s-5.72,1.28-5.72,5.43v4.69c0,4.16,1.66,5.41,5.72,5.41s5.72-1.26,5.72-5.41v-4.69Z" />
    </svg>
  );
}

/** Sub-product brand lockup: "Cartão Ideal | por avenza" (inspired by Devin by Cognition). */
export const BrandWordmark = ({ className, showParent = true }: BrandWordmarkProps) => (
  <span className={cn("inline-flex items-center gap-2 whitespace-nowrap leading-none", className)}>
    <span className="font-sans text-[15px] font-semibold tracking-[-0.02em] text-fg">
      Cartão Ideal
    </span>
    {showParent && (
      <>
        <span aria-hidden="true" className="hidden h-3.5 w-px bg-line-strong/45 sm:inline-block" />
        <span className="hidden items-center gap-1 text-[11px] font-medium text-fg-3 sm:inline-flex">
          <span>por</span>
          <AvenzaParentWordmark className="h-[8px] text-fg-2" />
        </span>
      </>
    )}
  </span>
);
