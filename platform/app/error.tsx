"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Erro
      </p>
      <h2 className="text-xl font-semibold">Algo deu errado ao carregar esta página.</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Tente novamente. Se o problema persistir, verifique a fonte do cartão diretamente.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
      >
        Tentar novamente
      </button>
    </div>
  );
}
