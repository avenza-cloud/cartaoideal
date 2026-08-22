import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllCards } from "@/lib/cards";
import { CardCatalog } from "@/components/CardCatalog";
import { CompareBar } from "@/components/CompareBar";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Todos os cartões de crédito",
  description:
    "Catálogo completo de cartões de crédito brasileiros. Filtre por anuidade, cashback, pontos, sala VIP e segmento para encontrar o melhor cartão.",
};

export default async function CartoesPage() {
  const allCards = getAllCards();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28rem)]">
      <AppHeader />

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-28 pt-4 md:flex-row md:px-6">
        <Suspense>
          <CardCatalog allCards={allCards} />
        </Suspense>
      </div>

      <CompareBar />
    </div>
  );
}
