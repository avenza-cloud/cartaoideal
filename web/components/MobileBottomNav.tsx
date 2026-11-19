"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/AppHeader";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation bar (Avenza Lime pattern: >= 56px tall, 4 items,
 * active item in --brand-accent / --fg, inactive in --fg-3).
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 items-center border-t border-line bg-page px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-xs transition-colors duration-100",
              active ? "font-semibold text-brand-accent" : "font-medium text-fg-3 hover:text-fg"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.65} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
