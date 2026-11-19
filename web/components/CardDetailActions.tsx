"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, Check } from "lucide-react";
import { useCompareStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { CardCorrectionForm } from "@/components/CardCorrectionForm";
import { affiliateClickUrl } from "@/lib/affiliate";

interface CardDetailActionsProps {
  cardId: string;
  cardName: string;
  issuer: string;
  sourceUrl: string;
}

const ACTION_CLASS = "h-10 w-full min-w-0 gap-1.5 px-2.5 text-xs max-[359px]:[&_svg]:hidden";

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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="pointer-events-auto mx-auto grid max-w-xl grid-cols-4 gap-2 rounded-sheet border border-line bg-raised p-2 shadow-overlay">
        <Button asChild variant="ghost" className={ACTION_CLASS}>
          <Link href="/cartoes">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
        </Button>
        <Button type="button" variant="default" onClick={toggleCompare} className={ACTION_CLASS}>
          {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {selected ? "Comparando" : "Comparar"}
        </Button>
        <CardCorrectionForm
          cardId={cardId}
          cardName={cardName}
          issuer={issuer}
          sourceUrl={sourceUrl}
          triggerClassName={ACTION_CLASS}
        />
        <Button asChild variant="outline" className={ACTION_CLASS}>
          <a href={affiliateClickUrl(cardId)} target="_blank" rel="noopener noreferrer">
            Fonte
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
