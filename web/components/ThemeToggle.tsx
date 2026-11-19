"use client";

import { Contrast, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const ORDER = ["light", "dark", "contrast"] as const;
const LABELS: Record<(typeof ORDER)[number], string> = {
  light: "Tema claro — clique para escuro",
  dark: "Tema escuro — clique para alto contraste",
  contrast: "Alto contraste — clique para claro",
};

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const active = theme === "contrast" ? "contrast" : resolvedTheme === "dark" ? "dark" : "light";
  const next = ORDER[(ORDER.indexOf(active) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label="Alternar tema claro, escuro ou alto contraste"
      title={LABELS[active]}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-page text-fg-2 transition-colors duration-100 hover:border-line-strong hover:bg-surface hover:text-fg active:scale-[0.98]"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Contrast className="hidden h-4 w-4 [.contrast_&]:block" />
      <Moon className="h-4 w-4 dark:hidden [.contrast_&]:hidden" />
    </button>
  );
}
