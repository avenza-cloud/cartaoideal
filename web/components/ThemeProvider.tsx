"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

function ThemeAttributeSync() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const active = theme === "contrast" ? "contrast" : (resolvedTheme ?? "light");
    document.documentElement.setAttribute("data-theme", active);
  }, [theme, resolvedTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      themes={["light", "dark", "contrast"]}
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeAttributeSync />
      {children}
    </NextThemesProvider>
  );
}
