import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CardNotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:py-24">
      <p className="text-xs text-muted-foreground">Cartão não encontrado</p>
      <h2 className="mt-2 text-xl font-medium">Este cartão não está no catálogo.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ele pode ter sido removido ou o endereço pode estar incorreto. Procure pelo nome na lista
        completa.
      </p>
      <Button asChild className="mt-6">
        <Link href="/cartoes">Ver todos os cartões</Link>
      </Button>
    </div>
  );
}
