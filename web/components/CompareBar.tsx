"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, BarChart2 } from "lucide-react";
import { useCompareStore } from "@/lib/store";

export function CompareBar() {
  const { items, remove, clear } = useCompareStore();
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-3 py-3 pb-safe backdrop-blur sm:px-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">
            {items.length}/4 selecionados
          </span>
          {items.map((item) => (
            <div
              key={item.id}
              className="inline-flex max-w-full items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
            >
              <span className="max-w-[min(170px,52vw)] truncate text-[10px]">{item.name}</span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={clear} className="text-xs">
            Limpar
          </Button>
          <Button
            size="sm"
            className="text-xs"
            disabled={items.length < 2}
            onClick={() => router.push(`/comparar?ids=${items.map((i) => i.id).join(",")}`)}
          >
            <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
            Comparar {items.length > 0 ? `(${items.length})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
