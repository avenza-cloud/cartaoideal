import { ChatInterface } from "@/components/ChatInterface";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export const metadata = {
  title: "Assistente IA — Cartão Ideal por Avenza",
  description: "Converse com nossa IA para encontrar o cartão de crédito ideal.",
};

export default function ChatPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-page sm:h-dvh">
      <AppHeader alwaysBorder />
      <div className="shrink-0 border-b border-line bg-page px-4 py-3.5 sm:px-7">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Assistente de Cartões</h1>
          <p className="text-sm text-fg-3">
            Pergunte sobre qualquer cartão, isenção ou compare alternativas para seu perfil.
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col pb-16 md:pb-0">
        <ChatInterface />
      </div>
      <MobileBottomNav />
    </div>
  );
}
