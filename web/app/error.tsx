"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:py-24">
      <p className="text-xs text-muted-foreground">Erro</p>
      <h2 className="mt-2 text-xl font-medium">Algo deu errado ao carregar esta página.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Tente novamente. Se o problema persistir, verifique a fonte do cartão diretamente.
      </p>
      <Button type="button" onClick={reset} className="mt-6">
        Tentar novamente
      </Button>
    </div>
  );
}
