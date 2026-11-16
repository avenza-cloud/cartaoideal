import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:py-24">
      <p className="num text-xs text-muted-foreground">404</p>
      <h2 className="mt-2 text-xl font-medium">Página não encontrada</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        O endereço pode estar incorreto ou o conteúdo pode ter sido movido. O catálogo completo
        continua disponível.
      </p>
      <Button asChild className="mt-6">
        <Link href="/cartoes">Ver cartões</Link>
      </Button>
    </div>
  );
}
