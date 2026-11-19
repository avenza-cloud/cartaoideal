"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

function safeInternalPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\r\n]/.test(value)) return null;
  return value;
}

export function CardDetailBackLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeInternalPath(searchParams.get("from"));
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const isExternalReferrer = (() => {
      if (!document.referrer) return false;
      try {
        return new URL(document.referrer).origin !== window.location.origin;
      } catch {
        return true;
      }
    })();
    setCanGoBack(window.history.length > 1 && !isExternalReferrer);
  }, []);

  function handleBack() {
    if (canGoBack) {
      router.back();
      return;
    }
    router.push(from ?? "/cartoes");
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="mb-4 inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-fg-3 transition-colors duration-100 hover:text-fg"
    >
      <ArrowLeft className="h-4 w-4" />
      {canGoBack || from ? "Voltar" : "Todos os cartões"}
    </button>
  );
}
