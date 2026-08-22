import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  className?: string;
};

export const BrandWordmark = ({ className }: BrandWordmarkProps) => (
  <span
    className={cn(
      "font-sans text-sm font-medium leading-none tracking-[-0.02em] text-foreground",
      className
    )}
  >
    Cartão Ideal
  </span>
);
