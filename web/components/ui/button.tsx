import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-100 ease-out select-none active:not-disabled:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-disabled disabled:border-transparent aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "glow glow-accent bg-primary text-on-accent",
        /** Kept as an alias for primary so existing call sites inherit the single glowing CTA. */
        mark: "glow glow-accent bg-primary text-on-accent",
        outline:
          "border-line-strong bg-page text-fg hover:bg-surface aria-expanded:bg-surface",
        secondary:
          "bg-surface-2 text-fg hover:bg-surface-3 aria-expanded:bg-surface-3",
        ghost:
          "bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg aria-expanded:bg-surface-2",
        destructive:
          "glow glow-danger bg-danger text-on-danger",
        link: "h-auto rounded-sm bg-transparent px-0 text-fg underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base",
        icon: "size-10 px-0",
        "icon-xs": "size-7 px-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 px-0",
        "icon-lg": "size-12 px-0",
      },
    },
    compoundVariants: [
      {
        variant: ["default", "mark", "destructive"],
        size: ["xs", "sm", "icon-xs", "icon-sm"],
        className: "glow-subtle",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
