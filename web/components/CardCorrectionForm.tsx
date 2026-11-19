"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CardCorrectionFormProps {
  cardId: string;
  cardName: string;
  issuer: string;
  sourceUrl: string;
  triggerClassName?: string;
}

const FIELD_OPTIONS = [
  "Anuidade",
  "Pontuação / cashback",
  "Lounge",
  "Elegibilidade",
  "Renda mínima",
  "Investimento mínimo",
  "IOF / spread",
  "Imagem ou nome",
  "Outro",
];

export function CardCorrectionForm({
  cardId,
  cardName,
  issuer,
  sourceUrl,
  triggerClassName,
}: CardCorrectionFormProps) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState(FIELD_OPTIONS[0]);
  const [suggestedValue, setSuggestedValue] = useState("");
  const [correctionSourceUrl, setCorrectionSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const response = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId,
        cardName,
        issuer,
        field,
        suggestedValue,
        sourceUrl: correctionSourceUrl,
        notes,
        pageSourceUrl: sourceUrl,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(body?.error ?? "Não foi possível enviar a correção.");
      return;
    }

    setStatus("success");
    setMessage(body?.issueUrl ? "Correção enviada para revisão." : "Correção enviada.");
  }

  function resetAndClose(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && status === "success") {
      setSuggestedValue("");
      setCorrectionSourceUrl("");
      setNotes("");
      setStatus("idle");
      setMessage("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5", triggerClassName)}>
          <PencilLine className="h-3.5 w-3.5" />
          Corrigir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corrigir informação</DialogTitle>
          <DialogDescription>
            Envie uma fonte oficial para abrir uma solicitação de revisão para este cartão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-panel bg-surface px-3.5 py-2.5">
            <p className="truncate text-sm font-semibold text-fg">{cardName}</p>
            <p className="truncate text-xs text-fg-3">{issuer}</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="correction-field" className="text-sm font-medium text-fg">
              Campo
            </label>
            <select
              id="correction-field"
              value={field}
              onChange={(event) => setField(event.target.value)}
              className="h-10 w-full rounded-field border border-line-strong bg-field px-3 text-sm text-fg transition-colors duration-100 hover:border-fg focus-visible:border-accent-line"
            >
              {FIELD_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="correction-value" className="text-sm font-medium text-fg">
              Valor correto
            </label>
            <Input
              id="correction-value"
              required
              value={suggestedValue}
              onChange={(event) => setSuggestedValue(event.target.value)}
              placeholder="Ex: R$ 20.000"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="correction-source" className="text-sm font-medium text-fg">
              Fonte
            </label>
            <Input
              id="correction-source"
              required
              type="url"
              value={correctionSourceUrl}
              onChange={(event) => setCorrectionSourceUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="correction-notes" className="text-sm font-medium text-fg">
              Notas
            </label>
            <Textarea
              id="correction-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="O que mudou? Onde a fonte confirma?"
              className="min-h-24"
            />
          </div>

          {message && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-panel px-3.5 py-2.5 text-sm",
                status === "success"
                  ? "bg-success-tint text-success-text"
                  : "bg-danger-tint text-danger-text"
              )}
            >
              {status === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="default"
            size="lg"
            disabled={status === "submitting" || status === "success"}
            className="w-full"
          >
            {status === "submitting" ? "Enviando..." : "Enviar correção"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
