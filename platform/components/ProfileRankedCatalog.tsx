"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { CardCard } from "@/components/CardCard";
import { scoreCardValues } from "@/lib/card-value";
import { useProfileStore } from "@/lib/store";
import { useValueAssumptions } from "@/lib/use-value-assumptions";
import type { CardFacet } from "@/types/cards";

const PAGE_SIZE = 48;

interface ProfileRankedCatalogProps {
  cards: CardFacet[];
  rankingMode: "profile" | "general";
}

export function ProfileRankedCatalog({ cards, rankingMode }: ProfileRankedCatalogProps) {
  const profile = useProfileStore((state) => state.profile);
  const assumptions = useValueAssumptions();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const scored = useMemo(() => {
    if (!profile || rankingMode === "general") return null;
    return scoreCardValues(cards, profile, "profile", assumptions);
  }, [cards, profile, assumptions, rankingMode]);

  const totalCount = scored?.length ?? cards.length;
  const hasMore = visibleCount < totalCount;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [cards, profile, rankingMode]);

  useEffect(() => {
    if (!hasMore) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + PAGE_SIZE, totalCount));
        }
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, totalCount, visibleCount]);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground">Nenhum cartão encontrado com esses filtros.</p>
      </div>
    );
  }

  if (scored) {
    const visibleScored = scored.slice(0, visibleCount);

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border bg-card/50 px-4 py-3">
          <p className="text-sm font-semibold">Classificado para o seu perfil</p>
          <p className="text-xs text-muted-foreground">
            Ordenado por valor líquido após anuidade, benefícios, retorno e custos internacionais.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleScored.map((score, idx) => (
            <CardCard
              key={score.card.card_stable_id}
              card={score.card}
              valueScore={score}
              rank={idx + 1}
              compact
            />
          ))}
        </div>
        <LoadMoreMarker
          markerRef={loadMoreRef}
          shown={visibleScored.length}
          total={totalCount}
          hasMore={hasMore}
        />
      </div>
    );
  }

  const visibleCards = cards.slice(0, visibleCount);

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
        {visibleCards.map((card, idx) => (
          <CardCard key={card.card_stable_id} card={card} rank={idx + 1} />
        ))}
      </div>
      <LoadMoreMarker
        markerRef={loadMoreRef}
        shown={visibleCards.length}
        total={totalCount}
        hasMore={hasMore}
      />
    </div>
  );
}

interface LoadMoreMarkerProps {
  markerRef: RefObject<HTMLDivElement | null>;
  shown: number;
  total: number;
  hasMore: boolean;
}

function LoadMoreMarker({ markerRef, shown, total, hasMore }: LoadMoreMarkerProps) {
  return (
    <div
      ref={markerRef}
      className="flex min-h-12 items-center justify-center py-2 text-xs text-muted-foreground"
    >
      {hasMore ? `Mostrando ${shown} de ${total}` : `${total} cartões`}
    </div>
  );
}
