"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

function safeInternalPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\r\n]/.test(value)) return null;
  return value;
}

export function CardDetailBackLink() {
  const searchParams = useSearchParams();
  const from = safeInternalPath(searchParams.get("from"));
  const href = from ?? "/cartoes";

  return (
    <Link
      href={href}
      className="mb-4 hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {from ? "Voltar para análise" : "Todos os cartões"}
    </Link>
  );
}
