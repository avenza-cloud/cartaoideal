import { Suspense } from "react";
import { filterCards, getAllCards } from "@/lib/cards";
import { CardFilters } from "@/components/CardFilters";
import { CompareBar } from "@/components/CompareBar";
import { AppHeader } from "@/components/AppHeader";
import { ProfileRankedCatalog } from "@/components/ProfileRankedCatalog";
import type { CardFilters as IFilters, MarketSegment } from "@/types/cards";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function CartoesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const filters: IFilters = {};
  if (params.segment) filters.segment = params.segment as MarketSegment;
  if (params.network) filters.network = params.network;
  if (params.lounge === "true") filters.lounge = true;
  if (params.rewardReturn === "true" || params.cashback === "true") {
    filters.rewardReturn = true;
  }
  if (params.points === "true") filters.points = true;
  if (params.zeroFee === "true") filters.zeroFee = true;
  if (params.maxFee) filters.maxFee = Number(params.maxFee);
  if (params.search) filters.search = params.search;

  const cards = filterCards(filters);
  const total = getAllCards().length;
  const rankingMode = params.rank === "general" ? "general" : "profile";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28rem)]">
      <AppHeader totalCards={total} />

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-28 pt-4 md:flex-row md:px-6">
        <Suspense>
          <CardFilters />
        </Suspense>

        <main className="flex-1 min-w-0">
          <ProfileRankedCatalog cards={cards} rankingMode={rankingMode} />
        </main>
      </div>

      <CompareBar />
    </div>
  );
}

export function generateStaticParams() {
  return [];
}
