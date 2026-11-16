"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Home, UserRound } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { BrandWordmark } from "@/components/BrandWordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background px-3 sm:px-4 md:px-6">
      <div className="flex h-full items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="h-6 w-6 shrink-0" />
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
                  "flex items-center gap-1.5 h-8 rounded-md px-3 text-xs font-medium transition-colors",
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
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
