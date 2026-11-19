"use client";

import { BarChart2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/lib/store";

export function CompareBar() {
  const { items, remove, clear } = useCompareStore();
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-18 z-50 px-3 sm:px-6 md:bottom-5">
      <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-sheet border border-line bg-raised px-4 py-3 shadow-overlay sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="num text-sm font-medium text-fg-2">{items.length}/4 selecionados</span>
          {items.map((item) => (
            <div
              key={item.id}
              className="inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-surface-2 pl-3 pr-1 text-xs font-medium text-fg"
            >
              <span className="max-w-[min(170px,50vw)] truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Remover ${item.name} da comparação`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-fg-3 transition-colors duration-100 hover:bg-surface-3 hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={clear}>
            Limpar
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={items.length < 2}
            onClick={() => router.push(`/comparar?ids=${items.map((i) => i.id).join(",")}`)}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Comparar {items.length > 0 ? `(${items.length})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
