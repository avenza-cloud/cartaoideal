import Link from "next/link";

export default function CardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Cartão não encontrado
      </p>
      <h2 className="text-xl font-semibold">Este cartão não está no catálogo.</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Ele pode ter sido removido ou o endereço pode estar incorreto.
      </p>
      <Link
        href="/cartoes"
        className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
      >
        Ver todos os cartões
      </Link>
    </div>
  );
}
