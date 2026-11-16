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

// Four equal cells; icons drop out below 360px so labels never overflow.
const ACTION_CLASS = "h-10 w-full min-w-0 gap-1.5 px-1.5 text-xs max-[359px]:[&_svg]:hidden";

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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-2 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Button asChild variant="outline" className={ACTION_CLASS}>
          <Link href="/cartoes">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
        </Button>
        <Button type="button" variant="mark" onClick={toggleCompare} className={ACTION_CLASS}>
          {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          Comparar
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
