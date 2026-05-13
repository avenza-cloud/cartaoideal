import Link from "next/link";
import { Suspense } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { CompareBar } from "@/components/CompareBar";
import { PersonalizedRanking } from "@/components/PersonalizedRanking";
import { CardProgressionPath } from "@/components/CardProgressionPath";
import { ProfileOnboarding } from "@/components/ProfileOnboarding";
import { AppHeader } from "@/components/AppHeader";
import { AdSlot } from "@/components/AdSlot";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Coins, Sparkles } from "lucide-react";
import { getAllCards } from "@/lib/cards";

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
      <ProfileOnboarding />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_28rem)]">
        <AppHeader />

        <main className="mx-auto max-w-7xl space-y-4 px-4 pb-28 pt-5 md:px-6">
          {/* Hero text */}
          <section className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-3 font-mono text-[10px]">
              {totalCards} cartões estruturados
            </Badge>
            <h1 className="mx-auto text-4xl font-semibold md:text-5xl">
              Pergunte. Compare. Decida.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Configure seu perfil abaixo para ver o ranking personalizado. Use
              o chat para tirar dúvidas, comparar cartões e explorar benefícios.
            </p>
          </section>

          {/* Chat hero */}
          <section className="mx-auto max-w-4xl">
            <ChatInterface variant="hero" />
          </section>

          {/* Quick-access tiles */}

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

        <footer className="border-t border-border/70 px-6 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Dados do catálogo podem conter imprecisões. Verifique com o emissor
            antes de contratar.
          </p>
        </footer>
      </div>

      <CompareBar />
    </>
  );
}
interface QuickTileProps {
  href: string;
  icon: typeof Sparkles;
  label: string;
  detail: string;
}

function QuickTile({
  href,
  icon: Icon,
  label,
  detail,
}: React.PropsWithChildren<QuickTileProps>) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border bg-card/60 px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      </div>
      <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
    </Link>
  );
}
