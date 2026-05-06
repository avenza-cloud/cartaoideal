"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, BarChart2 } from "lucide-react";
import { useCompareStore } from "@/lib/store";
import { CLIENT_CARD_OPTIONS } from "@/lib/client-card-options";

export function CompareBar() {
  const { ids, remove, clear } = useCompareStore();
  const router = useRouter();
  const byId = new Map(CLIENT_CARD_OPTIONS.map((card) => [card.id, card]));

  if (ids.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground font-mono">
            {ids.length}/4 selecionados
          </span>
          {ids.map((id) => (
            <div
              key={id}
              className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1"
            >
              <span className="max-w-[170px] truncate text-[10px]">
                {byId.get(id)?.name ?? `${id.slice(0, 20)}...`}
              </span>
              <button
                onClick={() => remove(id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={clear} className="text-xs">
            Limpar
          </Button>
          <Button
            size="sm"
            className="text-xs"
            disabled={ids.length < 2}
            onClick={() =>
              router.push(`/comparar?ids=${ids.join(",")}`)
            }
          >
            <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
            Comparar {ids.length > 0 ? `(${ids.length})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
