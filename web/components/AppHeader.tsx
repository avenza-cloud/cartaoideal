"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Home, UserRound } from "lucide-react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/88 px-3 py-3 backdrop-blur sm:px-4 md:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-card text-base leading-none">
            <span aria-hidden="true">💳</span>
          </div>
          <BrandWordmark />
        </Link>

        <nav className="flex shrink-0 items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
