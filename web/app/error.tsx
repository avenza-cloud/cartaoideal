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
    <div className="mx-auto w-full max-w-xl px-4 py-20 sm:py-28">
      <div className="rounded-panel bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-fg">
          Erro: algo deu errado ao carregar esta página.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-2">
          Tente novamente. Se o problema persistir, verifique as condições do cartão diretamente na
          fonte oficial.
        </p>
        <Button type="button" onClick={reset} className="mt-6">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
