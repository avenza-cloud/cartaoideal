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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/88 px-4 py-3 backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-sm font-semibold leading-none">Cartões BR</span>
            {totalCards !== undefined && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {totalCards} cartões
              </span>
            )}
          </div>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            const disabled = href === "/comparar";
            return (
              <Link
                key={href}
                href={disabled ? "/cartoes" : href}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-colors",
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
