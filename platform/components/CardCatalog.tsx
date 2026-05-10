"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { filterCards } from "@/lib/filter-cards";
import { CardFilters } from "@/components/CardFilters";
import { ProfileRankedCatalog } from "@/components/ProfileRankedCatalog";
import type { CardFacet, CardFilters as IFilters, MarketSegment } from "@/types/cards";

interface ActiveFilters {
  segment: string;
  network: string;
  lounge: boolean;
  rewardReturn: boolean;
  points: boolean;
  zeroFee: boolean;
  search: string;
  rank: "profile" | "general";
}

const EMPTY: ActiveFilters = {
  segment: "",
  network: "",
  lounge: false,
  rewardReturn: false,
  points: false,
  zeroFee: false,
  search: "",
  rank: "profile",
};

function fromSearchParams(params: URLSearchParams): ActiveFilters {
  return {
    segment: params.get("segment") ?? "",
    network: params.get("network") ?? "",
    lounge: params.get("lounge") === "true",
    rewardReturn: params.get("rewardReturn") === "true",
    points: params.get("points") === "true",
    zeroFee: params.get("zeroFee") === "true",
    search: params.get("search") ?? "",
    rank: params.get("rank") === "general" ? "general" : "profile",
  };
}

function toFilters(active: ActiveFilters): IFilters {
  const f: IFilters = {};
  if (active.segment) f.segment = active.segment as MarketSegment;
  if (active.network) f.network = active.network;
  if (active.lounge) f.lounge = true;
  if (active.rewardReturn) f.rewardReturn = true;
  if (active.points) f.points = true;
  if (active.zeroFee) f.zeroFee = true;
  if (active.search) f.search = active.search;
  return f;
}

function toParams(active: ActiveFilters): string {
  const p = new URLSearchParams();
  if (active.segment) p.set("segment", active.segment);
  if (active.network) p.set("network", active.network);
  if (active.lounge) p.set("lounge", "true");
  if (active.rewardReturn) p.set("rewardReturn", "true");
  if (active.points) p.set("points", "true");
  if (active.zeroFee) p.set("zeroFee", "true");
  if (active.search) p.set("search", active.search);
  if (active.rank === "general") p.set("rank", "general");
  return p.toString();
}

interface CardCatalogProps {
  allCards: CardFacet[];
}

export function CardCatalog({ allCards }: CardCatalogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [active, setActive] = useState<ActiveFilters>(() =>
    fromSearchParams(searchParams)
  );

  // Track whether the last update came from the search input (needs debounce)
  const isSearchUpdate = useRef(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef<string>(toParams(active));

  // Sync URL → state only when URL changes externally (browser back/forward)
  useEffect(() => {
    const incoming = searchParams.toString();
    if (incoming !== lastPushed.current) {
      setActive(fromSearchParams(searchParams));
      lastPushed.current = incoming;
    }
  }, [searchParams]);

  // Sync state → URL after every state change, debounced only for search
  useEffect(() => {
    const wasSearch = isSearchUpdate.current;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    const commit = () => {
      const qs = toParams(active);
      if (qs === lastPushed.current) return;
      lastPushed.current = qs;
      router.replace(qs ? `/cartoes?${qs}` : "/cartoes", { scroll: false });
    };

    if (wasSearch) {
      searchDebounce.current = setTimeout(commit, 300);
    } else {
      commit();
    }

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [active, router]);

  const update = useCallback((patch: Partial<ActiveFilters>, isSearch = false) => {
    isSearchUpdate.current = isSearch;
    setActive((prev) => ({ ...prev, ...patch }));
  }, []);

  const filtered = useMemo(
    () => filterCards(allCards, toFilters(active)),
    [allCards, active]
  );

  return (
    <>
      <CardFilters active={active} update={update} totalFiltered={filtered.length} totalAll={allCards.length} />
      <main className="flex-1 min-w-0">
        <ProfileRankedCatalog cards={filtered} rankingMode={active.rank} />
      </main>
    </>
  );
}
