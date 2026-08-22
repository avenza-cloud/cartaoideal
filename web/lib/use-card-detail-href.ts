"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function useCardDetailHrefBuilder(): (cardId: string) => string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return useMemo(() => {
    const currentPath = `${pathname}${search ? `?${search}` : ""}`;

    return (cardId: string) => {
      const params = new URLSearchParams({ from: currentPath });

      return `/cartoes/${cardId}?${params.toString()}`;
    };
  }, [pathname, search]);
}

export function useCardDetailHref(cardId: string): string {
  return useCardDetailHrefBuilder()(cardId);
}
