"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import Link from "next/link";
import { CardCard } from "@/components/CardCard";
import { Tag } from "@/components/card";
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
  }, []);

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
  }, [hasMore, totalCount]);

  if (cards.length === 0) {
    return (
      <div className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-md rounded-panel bg-surface px-6 py-12 text-center">
          <p className="text-base font-semibold text-fg">Nenhum cartão encontrado</p>
          <p className="mt-1 text-sm text-fg-2">
            Tente remover alguns filtros ou buscar por outro emissor.
          </p>
        </div>
      </div>
    );
  }

  if (scored) {
    const visibleScored = scored.slice(0, visibleCount);

    return (
      <div className="space-y-5 px-4 pb-28 pt-5 sm:px-7 md:pt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Catálogo de cartões</h1>
          <Tag variant="quiet" className="num">
            {totalCount} resultados
          </Tag>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface px-4 py-3 text-sm text-fg-2">
          <p>
            <strong className="font-semibold text-fg">Classificado para o seu perfil</strong> ·
            Ordenado por valor líquido após anuidade, benefícios, retorno e custos internacionais.
          </p>
          <Link
            href="/perfil"
            className="shrink-0 text-xs font-medium text-fg underline underline-offset-4 hover:text-brand-accent"
          >
            Ajustar perfil
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    <div className="space-y-5 px-4 pb-28 pt-5 sm:px-7 md:pt-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Catálogo de cartões</h1>
        <Tag variant="quiet" className="num">
          {totalCount} cartões
        </Tag>
      </div>

      {rankingMode === "general" && (
        <div className="rounded-panel bg-surface px-4 py-3 text-sm text-fg-2">
          <strong className="font-semibold text-fg">Ranking geral</strong> · Ordenado pelo ranking
          padrão do catálogo, sem usar seu perfil.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      className="num flex min-h-12 items-center justify-center py-2 text-xs text-fg-3"
    >
      {hasMore ? `Mostrando ${shown} de ${total}` : `${total} cartões`}
    </div>
  );
}
