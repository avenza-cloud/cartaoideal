"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, Check } from "lucide-react";
import { useCompareStore } from "@/lib/store";

interface CardDetailActionsProps {
  cardId: string;
  sourceUrl: string;
}

export function CardDetailActions({ cardId, sourceUrl }: CardDetailActionsProps) {
  const { ids, add, remove, canAdd } = useCompareStore();
  const selected = ids.includes(cardId);

  function toggleCompare() {
    if (selected) {
      remove(cardId);
      return;
    }
    if (canAdd()) add(cardId);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto grid max-w-md grid-cols-3 gap-2 rounded-2xl border bg-background/92 p-2 shadow-[0_18px_80px_rgba(0,0,0,0.45)] backdrop-blur">
      <Link
        href="/cartoes"
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs text-muted-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>
      <button
        type="button"
        onClick={toggleCompare}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-medium text-background"
      >
        {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        Comparar
      </button>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs text-muted-foreground"
      >
        Fonte
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
