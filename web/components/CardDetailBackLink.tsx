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
      className="mb-5 hidden items-center gap-1.5 rounded-full text-sm font-medium text-fg-3 transition-colors duration-100 hover:text-fg md:inline-flex"
    >
      <ArrowLeft className="h-4 w-4" />
      {from ? "Voltar para análise" : "Todos os cartões"}
    </Link>
  );
}
