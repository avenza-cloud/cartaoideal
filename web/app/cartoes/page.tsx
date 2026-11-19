import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllCards } from "@/lib/cards";
import { CardCatalog } from "@/components/CardCatalog";
import { CompareBar } from "@/components/CompareBar";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export const metadata: Metadata = {
  title: "Todos os cartões de crédito",
  description:
    "Catálogo completo de cartões de crédito brasileiros. Filtre por anuidade, cashback, pontos, sala VIP e segmento para encontrar o melhor cartão.",
};

export default async function CartoesPage() {
  const allCards = getAllCards();

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AppHeader alwaysBorder />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col md:flex-row">
        <Suspense>
          <CardCatalog allCards={allCards} />
        </Suspense>
      </div>

      <CompareBar />
      <MobileBottomNav />
    </div>
  );
}
