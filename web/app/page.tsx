import { Suspense } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { CompareBar } from "@/components/CompareBar";
import { PersonalizedRanking } from "@/components/PersonalizedRanking";
import { CardProgressionPath } from "@/components/CardProgressionPath";
import { ProfileOnboarding } from "@/components/ProfileOnboarding";
import { AppHeader } from "@/components/AppHeader";
import { AdSlot } from "@/components/AdSlot";
import { getAllCards } from "@/lib/cards";
import { CARD_OPTIONS, CURATED_CARD_OPTIONS } from "@/lib/card-options.server";

export const metadata = {
  title: "Cartão Ideal — Compare os melhores cartões de crédito",
  description:
    "Encontre o cartão de crédito ideal para o seu perfil. Compare anuidades, benefícios e recompensas de cartões brasileiros.",
};

export default function HomePage() {
  const totalCards = getAllCards().length;

  return (
    <>
      {/* Fullscreen onboarding — renders as overlay until completed or skipped */}
      <ProfileOnboarding cardOptions={CARD_OPTIONS} curatedOptions={CURATED_CARD_OPTIONS} />

      <div className="min-h-screen">
        <AppHeader />

        <main className="mx-auto max-w-7xl space-y-4 px-4 pb-28 pt-8 md:px-6 md:pt-12">
          {/* Hero text */}
          <section className="mx-auto max-w-4xl pb-2">
            <h1 className="text-3xl font-medium md:text-5xl">Pergunte. Compare. Decida.</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Configure seu perfil abaixo para ver o ranking personalizado. Use o chat para tirar
              dúvidas, comparar cartões e explorar benefícios.
            </p>
            <p className="num mt-2 text-xs text-muted-foreground">
              {totalCards} cartões estruturados
            </p>
          </section>

          {/* Chat hero */}
          <section className="mx-auto max-w-4xl">
            <ChatInterface variant="hero" />
          </section>

          {/* Personalized ranking (profile setup or results) */}
          <section className="mx-auto max-w-4xl">
            <Suspense>
              <PersonalizedRanking />
            </Suspense>
          </section>

          {/* Progression pathway */}
          <section className="mx-auto max-w-4xl">
            <Suspense>
              <CardProgressionPath />
            </Suspense>
          </section>

          <AdSlot
            slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_CATALOG ?? ""}
            format="auto"
            className="mx-auto max-w-4xl"
          />
        </main>
      </div>

      <CompareBar />
    </>
  );
}
