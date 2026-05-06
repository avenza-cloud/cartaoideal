import { ChatInterface } from "@/components/ChatInterface";
import { AppHeader } from "@/components/AppHeader";

export const metadata = {
  title: "Assistente IA — Cartões BR",
  description: "Converse com nossa IA para encontrar o cartão de crédito ideal.",
};

export default function ChatPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <div className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold">Assistente de Cartões</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pergunte sobre qualquer cartão ou peça recomendações personalizadas.
        </p>
      </div>
      <div className="flex-1 flex flex-col">
        <ChatInterface />
      </div>
    </div>
  );
}
