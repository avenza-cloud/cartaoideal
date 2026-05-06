"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Home, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/perfil", label: "Perfil", icon: UserRound },
  { href: "/comparar", label: "Comparar", icon: BarChart3 },
];

interface AppHeaderProps {
  totalCards?: number;
}

export function AppHeader({ totalCards }: AppHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/88 px-3 py-3 backdrop-blur sm:px-4 md:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card text-lg leading-none">
            <span aria-hidden="true">💳</span>
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-none">Meu Cartão Ideal</span>
            {totalCards !== undefined && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {totalCards} cartões
              </span>
            )}
          </div>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            const disabled = href === "/comparar";
            return (
              <Link
                key={href}
                href={disabled ? "/cartoes" : href}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors sm:px-3",
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
