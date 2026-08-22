"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, Check } from "lucide-react";
import { useCompareStore } from "@/lib/store";
import { CardCorrectionForm } from "@/components/CardCorrectionForm";
import { affiliateClickUrl } from "@/lib/affiliate";

interface CardDetailActionsProps {
  cardId: string;
  cardName: string;
  issuer: string;
  sourceUrl: string;
}

export function CardDetailActions({ cardId, cardName, issuer, sourceUrl }: CardDetailActionsProps) {
  const { ids, add, remove, canAdd } = useCompareStore();
  const selected = ids.includes(cardId);

  function toggleCompare() {
    if (selected) {
      remove(cardId);
      return;
    }
    if (canAdd()) add({ id: cardId, name: cardName });
  }

  return (
    <div className="fixed inset-x-3 bottom-safe z-40 mx-auto grid max-w-lg grid-cols-4 gap-2 rounded-xl border bg-background/92 p-2 shadow-[0_18px_80px_rgba(0,0,0,0.45)] backdrop-blur">
      <Link
        href="/cartoes"
        className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs text-muted-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>
      <button
        type="button"
        onClick={toggleCompare}
        className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-foreground px-2 text-xs font-medium text-background sm:px-3"
      >
        {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        Comparar
      </button>
      <CardCorrectionForm
        cardId={cardId}
        cardName={cardName}
        issuer={issuer}
        sourceUrl={sourceUrl}
        triggerClassName="h-10 w-full min-w-0 rounded-xl px-2 text-xs text-muted-foreground"
      />
      <a
        href={affiliateClickUrl(cardId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs text-muted-foreground"
      >
        Fonte
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
