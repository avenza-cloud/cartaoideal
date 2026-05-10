import { Suspense } from "react";
import { getAllCards } from "@/lib/cards";
import { CardCatalog } from "@/components/CardCatalog";
import { CompareBar } from "@/components/CompareBar";
import { AppHeader } from "@/components/AppHeader";

export default async function CartoesPage() {
  const allCards = getAllCards();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28rem)]">
      <AppHeader totalCards={allCards.length} />

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-28 pt-4 md:flex-row md:px-6">
        <Suspense>
          <CardCatalog allCards={allCards} />
        </Suspense>
      </div>

      <CompareBar />
    </div>
  );
}

export function generateStaticParams() {
  return [];
}
