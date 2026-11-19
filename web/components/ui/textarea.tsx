import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-field border border-line-strong bg-field px-3 py-2.5 text-base text-fg transition-colors duration-100 placeholder:text-fg-3 hover:not-disabled:border-fg focus-visible:border-accent-line disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-disabled aria-invalid:border-danger md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
