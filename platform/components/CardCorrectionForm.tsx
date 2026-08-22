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
        <Button variant="outline" size="sm" className={cn("gap-1.5", triggerClassName)}>
          <PencilLine className="h-3.5 w-3.5" />
          Corrigir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corrigir informação</DialogTitle>
          <DialogDescription>
            Envie uma fonte para abrir uma solicitação de revisão para este cartão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-xl border bg-muted/20 px-3 py-2">
            <p className="truncate text-sm font-medium">{cardName}</p>
            <p className="truncate text-xs text-muted-foreground">{issuer}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Campo</label>
            <select
              value={field}
              onChange={(event) => setField(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              {FIELD_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Valor correto</label>
            <Input
              required
              value={suggestedValue}
              onChange={(event) => setSuggestedValue(event.target.value)}
              placeholder="Ex: R$ 20.000"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fonte</label>
            <Input
              required
              type="url"
              value={correctionSourceUrl}
              onChange={(event) => setCorrectionSourceUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notas</label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="O que mudou? Onde a fonte confirma?"
              className="min-h-24"
            />
          </div>

          {message && (
            <div className="flex items-start gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-xs">
              {status === "success" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              )}
              <span>{message}</span>
            </div>
          )}

          <Button
            type="submit"
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
