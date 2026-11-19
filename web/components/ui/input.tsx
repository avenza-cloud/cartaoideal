import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-field border border-line-strong bg-field px-3 py-1 text-base text-fg transition-colors duration-100 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg placeholder:text-fg-3 hover:not-disabled:border-fg focus-visible:border-accent-line disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-disabled aria-invalid:border-danger md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Input };
