import { ChatInterface } from "@/components/ChatInterface";
import { AppHeader } from "@/components/AppHeader";

export const metadata = {
  title: "Assistente IA — Cartão Ideal",
  description: "Converse com nossa IA para encontrar o cartão de crédito ideal.",
};

export default function ChatPage() {
  return (
    // From `sm` up the page is exactly one viewport tall, so the chat takes
    // whatever the 56px header and the title leave, with no page scroll.
    <div className="flex min-h-dvh flex-col sm:h-dvh">
      <AppHeader />
      <div className="shrink-0 border-b px-4 py-4 sm:px-6">
        <h1 className="text-xl font-medium">Assistente de Cartões</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pergunte sobre qualquer cartão ou peça recomendações personalizadas.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatInterface />
      </div>
    </div>
  );
}
