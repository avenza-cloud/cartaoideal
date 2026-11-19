"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Home, MessageSquare, UserRound } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { AvenzaParentLink, BrandWordmark } from "@/components/BrandWordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/chat", label: "Assistente", icon: MessageSquare },
  { href: "/perfil", label: "Perfil", icon: UserRound },
] as const;

export function AppHeader({ alwaysBorder = false }: { alwaysBorder?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-14 bg-page/95 backdrop-blur-xs transition-[border-color] duration-150 px-3 sm:px-5 md:px-7",
        alwaysBorder || scrolled ? "border-b border-line" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2">
        <div className="inline-flex min-w-0 items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-w-0 items-center gap-2.5 rounded-md py-1 focus-visible:outline-offset-4"
          >
            <BrandMark className="h-[20px] w-[24px]" />
            <BrandWordmark showParent={false} />
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-3.5 w-px bg-line-strong/45 sm:inline-block"
          />
          <AvenzaParentLink className="hidden rounded-md py-1 sm:inline-flex" />
        </div>

        <nav aria-label="Navegação principal" className="flex shrink-0 items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-colors duration-100 sm:px-3.5",
                  active
                    ? "bg-brand-wash font-semibold text-fg"
                    : "text-fg-2 hover:bg-surface hover:text-fg"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5",
                    active ? "text-brand-accent" : "text-fg-3"
                  )}
                />
                <span className="hidden md:inline">{label}</span>
                <span className="sr-only md:hidden">{label}</span>
              </Link>
            );
          })}
          <div className="ml-1">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
