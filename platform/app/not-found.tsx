import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        404
      </p>
      <h2 className="text-xl font-semibold">Página não encontrada</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        O endereço pode estar incorreto ou o conteúdo pode ter sido movido.
      </p>
      <Link
        href="/cartoes"
        className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
      >
        Ver cartões
      </Link>
    </div>
  );
}
