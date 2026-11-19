import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-20 sm:py-28">
      <div className="rounded-panel bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Página não encontrada</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-2">
          O endereço pode estar incorreto ou o conteúdo pode ter sido movido. O catálogo completo
          continua disponível.
        </p>
        <Button asChild className="mt-6">
          <Link href="/cartoes">Ver cartões</Link>
        </Button>
      </div>
    </div>
  );
}
