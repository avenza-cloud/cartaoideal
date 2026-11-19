import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CardNotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-20 sm:py-28">
      <div className="rounded-panel bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-fg">
          Este cartão não está no catálogo.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-2">
          Ele pode ter sido removido ou o endereço pode estar incorreto. Procure pelo nome na lista
          completa.
        </p>
        <Button asChild className="mt-6">
          <Link href="/cartoes">Ver todos os cartões</Link>
        </Button>
      </div>
    </div>
  );
}
