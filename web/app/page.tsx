import { Suspense } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { CompareBar } from "@/components/CompareBar";
import { PersonalizedRanking } from "@/components/PersonalizedRanking";
import { CardProgressionPath } from "@/components/CardProgressionPath";
import { ProfileOnboarding } from "@/components/ProfileOnboarding";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AdSlot } from "@/components/AdSlot";
import { Tag } from "@/components/card";
import { getAllCards } from "@/lib/cards";
import { CARD_OPTIONS, CURATED_CARD_OPTIONS } from "@/lib/card-options.server";

export const metadata = {
  title: "Cartão Ideal por Avenza — Compare os melhores cartões de crédito",
  description:
    "Encontre o cartão de crédito ideal para o seu perfil. Compare anuidades, benefícios e recompensas de cartões brasileiros.",
};

export default function HomePage() {
  const totalCards = getAllCards().length;

  return (
    <>
      {/* Fullscreen onboarding — renders as overlay until completed or skipped */}
      <ProfileOnboarding cardOptions={CARD_OPTIONS} curatedOptions={CURATED_CARD_OPTIONS} />

      <div className="min-h-screen bg-page">
        <AppHeader />

        <main className="mx-auto max-w-[840px] space-y-10 px-4 pb-28 pt-7 sm:px-6 md:pt-12">
          {/* Editorial Hero */}
          <section className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Pergunte. Compare. Decida.
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-relaxed text-fg-2 sm:text-[15px]">
              <p className="max-w-xl">
                Descubra o valor líquido real de cada cartão para o seu gasto, patrimônio e rotina
                de viagens.
              </p>
              <Tag variant="quiet" className="num">
                {totalCards} cartões estruturados
              </Tag>
            </div>
          </section>

          {/* Floating AI Composer */}
          <section className="-mt-4">
            <ChatInterface variant="hero" />
          </section>

          {/* Personalized ranking (ledger rows) */}
          <section>
            <Suspense>
              <PersonalizedRanking />
            </Suspense>
          </section>

          {/* Progression pathway */}
          <section>
            <Suspense>
              <CardProgressionPath />
            </Suspense>
          </section>

          <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_CATALOG ?? ""} format="auto" />
        </main>
      </div>

      <CompareBar />
      <MobileBottomNav />
    </>
  );
}
