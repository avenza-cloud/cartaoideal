"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CardCard } from "@/components/CardCard";
import { scoreCardValues } from "@/lib/card-value";
import { useProfileStore } from "@/lib/store";
import { useValueAssumptions } from "@/lib/use-value-assumptions";
import type { CardFacet } from "@/types/cards";

interface ProfileRankedCatalogProps {
  cards: CardFacet[];
}

export function ProfileRankedCatalog({ cards }: ProfileRankedCatalogProps) {
  const profile = useProfileStore((state) => state.profile);
  const searchParams = useSearchParams();
  const assumptions = useValueAssumptions();
  const rankingMode = searchParams.get("rank") === "general" ? "general" : "profile";

  const scored = useMemo(() => {
    if (!profile || rankingMode === "general") return null;
    return scoreCardValues(cards, profile, "profile", assumptions);
  }, [cards, profile, assumptions, rankingMode]);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground">Nenhum cartão encontrado com esses filtros.</p>
      </div>
    );
  }

  if (scored) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border bg-card/50 px-4 py-3">
          <p className="text-sm font-semibold">Classificado para o seu perfil</p>
          <p className="text-xs text-muted-foreground">
            Ordenado por valor líquido após anuidade, benefícios, retorno e custos internacionais.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scored.map((score, idx) => (
            <CardCard
              key={score.card.card_stable_id}
              card={score.card}
              valueScore={score}
              rank={idx + 1}
              compact
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rankingMode === "general" && (
        <div className="rounded-2xl border bg-card/50 px-4 py-3">
          <p className="text-sm font-semibold">Ranking geral</p>
          <p className="text-xs text-muted-foreground">
            Ordenado pelo ranking padrão do catálogo, sem usar seu perfil.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, idx) => (
          <CardCard key={card.card_stable_id} card={card} rank={idx + 1} />
        ))}
      </div>
    </div>
  );
}
