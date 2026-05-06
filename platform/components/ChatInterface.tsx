"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, isTextUIPart } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputSubmit,
} from "@/components/ui/ai-prompt-box";
import { useCompareStore, useProfileStore } from "@/lib/store";
import { UserRound, LayoutList, CreditCard, ChevronDown, ChevronUp, ArrowUpRight, Check, Plus } from "lucide-react";
import Link from "next/link";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  variant?: "full" | "hero";
  className?: string;
}

/* ─── Tool artifact types ─── */
interface CardItem {
  id: string;
  nome: string;
  emissor: string;
  anuidade: number | string;
  lounge?: boolean | { has_lounge_access?: boolean };
  pontos?: boolean;
  cardArtUrl?: string;
  altText?: string;
  retornoFinanceiro?: { earning_summary?: string };
  pontuacao?: number;
  valorEstimado?: {
    elegivel?: boolean;
    bloqueios?: string[];
    valorLiquidoMensal?: number;
    valorLiquidoAnual?: number;
    retornoBrutoMensal?: number;
    beneficiosMensais?: number;
    beneficiosIntangiveisMensais?: number;
    anuidadeEfetivaMensal?: number;
    anuidadeEfetivaAnual?: number;
    custoInternacionalMensal?: number;
    pontoEquilibrioGastoMensal?: number | null;
    veredito?: string;
  } | null;
  seguroViagem?: boolean;
  concierge?: boolean;
}

function hasLounge(lounge: CardItem["lounge"]) {
  return typeof lounge === "boolean" ? lounge : !!lounge?.has_lounge_access;
}

function moneyLabel(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}/mês`;
}

function feeLabel(anuidade: number | string) {
  if (anuidade === 0 || anuidade === "free") return "Grátis";
  if (typeof anuidade === "number")
    return `R$${anuidade.toLocaleString("pt-BR")}/ano`;
  return String(anuidade);
}

/* ─── Mini card chip used in list artifacts ─── */
function MiniCard({ card, rank }: { card: CardItem; rank?: number }) {
  const { ids, add, remove, canAdd } = useCompareStore();
  const selected = ids.includes(card.id);
  const hasImage = card.cardArtUrl && card.cardArtUrl !== "unknown";
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card/60 px-2.5 py-2 text-xs">
      <Link
        href={`/cartoes/${card.id}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 transition-colors hover:text-foreground"
      >
        {rank !== undefined && (
          <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground">
            #{rank}
          </span>
        )}
        <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md border bg-zinc-950">
          {hasImage ? (
            <img
              src={card.cardArtUrl}
              alt={card.altText ?? card.nome}
              className="max-h-6 max-w-[40px] object-contain"
              loading="lazy"
            />
          ) : (
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{card.nome}</p>
          <p className="truncate text-[10px] text-muted-foreground">{card.emissor}</p>
        </div>
              <div className="hidden shrink-0 text-right min-[390px]:block">
          <p className="font-mono text-[10px] text-muted-foreground">{feeLabel(card.anuidade)}</p>
          {card.valorEstimado?.valorLiquidoMensal !== undefined ? (
            <p
              className={`font-mono text-[10px] ${
                card.valorEstimado.valorLiquidoMensal >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {moneyLabel(card.valorEstimado.valorLiquidoMensal)}
            </p>
          ) : card.pontuacao !== undefined ? (
            <p className="font-mono text-[10px] text-foreground/60">{card.pontuacao}pts</p>
          ) : null}
          {card.pontuacao !== undefined && card.valorEstimado?.valorLiquidoMensal !== undefined && (
            <p className="font-mono text-[10px] text-foreground/60">{card.pontuacao}/100</p>
          )}
        </div>
        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
      </Link>
      <button
        type="button"
        title={selected ? "Remover da comparação" : "Adicionar à comparação"}
        disabled={!selected && !canAdd()}
        onClick={() => (selected ? remove(card.id) : add(card.id))}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
          selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          !selected && !canAdd() && "opacity-40"
        )}
      >
        {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/* ─── Card list artifact ─── */
function CardListArtifact({ output }: { output: unknown }) {
  const cards = Array.isArray(output) ? (output as CardItem[]) : [];
  if (!cards.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {cards.map((c, i) => (
        <MiniCard key={c.id} card={c} rank={c.pontuacao !== undefined ? i + 1 : undefined} />
      ))}
    </div>
  );
}

/* ─── Compare artifact ─── */
function CardCompareArtifact({ output }: { output: unknown }) {
  const payload = output as
    | {
        cards?: CardItem[];
        delta?: {
          valorLiquidoMensal?: number;
          valorLiquidoAnual?: number;
          retornoBrutoMensal?: number;
          anuidadeMensal?: number;
          beneficiosMensais?: number;
        } | null;
        perfilUsado?: unknown;
        naoEncontrados?: string[];
      }
    | CardItem[];
  const cards = Array.isArray(payload) ? payload : payload.cards ?? [];
  if (cards.length < 2) return null;
  const delta = !Array.isArray(payload) ? payload.delta : null;
  const winner =
    cards[1]?.valorEstimado?.valorLiquidoMensal !== undefined &&
    cards[0]?.valorEstimado?.valorLiquidoMensal !== undefined
      ? delta?.valorLiquidoMensal && delta.valorLiquidoMensal > 0
        ? cards[1]
        : cards[0]
      : null;

  const rows: { label: string; key: (c: CardItem) => string }[] = [
    {
      label: "Valor líquido",
      key: (c) =>
        c.valorEstimado?.valorLiquidoMensal !== undefined
          ? moneyLabel(c.valorEstimado.valorLiquidoMensal)
          : "—",
    },
    {
      label: "Retorno",
      key: (c) =>
        c.valorEstimado?.retornoBrutoMensal !== undefined
          ? moneyLabel(c.valorEstimado.retornoBrutoMensal)
          : c.retornoFinanceiro?.earning_summary ?? "—",
    },
    {
      label: "Benefícios",
      key: (c) =>
        c.valorEstimado?.beneficiosMensais !== undefined
          ? moneyLabel(c.valorEstimado.beneficiosMensais)
          : c.valorEstimado?.beneficiosIntangiveisMensais !== undefined
            ? moneyLabel(c.valorEstimado.beneficiosIntangiveisMensais)
            : "—",
    },
    {
      label: "Anuidade efetiva",
      key: (c) =>
        c.valorEstimado?.anuidadeEfetivaMensal !== undefined
          ? `-${moneyLabel(c.valorEstimado.anuidadeEfetivaMensal).replace("+", "")}`
          : feeLabel(c.anuidade),
    },
    { label: "Anuidade", key: (c) => feeLabel(c.anuidade) },
    { label: "Lounge", key: (c) => (hasLounge(c.lounge) ? "Sim" : "Não") },
    { label: "Pontos", key: (c) => (c.pontos ? "Sim" : "Não") },
    {
      label: "Seg. viagem",
      key: (c) => (c.seguroViagem !== undefined ? (c.seguroViagem ? "Sim" : "Não") : "—"),
    },
    {
      label: "Concierge",
      key: (c) => (c.concierge !== undefined ? (c.concierge ? "Sim" : "Não") : "—"),
    },
  ];

  return (
    <div className="mt-2 space-y-2">
      {(delta || winner) && (
        <div className="rounded-xl border bg-card/65 p-3 text-xs">
          {winner && (
            <p className="font-semibold">
              Melhor no cálculo: <span className="text-foreground">{winner.nome}</span>
            </p>
          )}
          {delta && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniMetric label="Delta/mês" value={moneyLabel(delta.valorLiquidoMensal ?? 0)} strong />
              <MiniMetric label="Delta/ano" value={`R$${Math.round(delta.valorLiquidoAnual ?? 0).toLocaleString("pt-BR")}`} />
              <MiniMetric label="Retorno" value={moneyLabel(delta.retornoBrutoMensal ?? 0)} />
              <MiniMetric label="Anuidade" value={moneyLabel(-(delta.anuidadeMensal ?? 0))} />
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border text-xs">
        <table className="w-full min-w-[420px]">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="px-3 py-2 text-left font-normal text-muted-foreground">—</th>
            {cards.map((c) => (
              <th key={c.id} className="px-3 py-2 text-left font-medium">
                <Link href={`/cartoes/${c.id}`} className="hover:underline">
                  {c.nome}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="px-3 py-1.5 text-muted-foreground">{row.label}</td>
              {cards.map((c) => (
                <td key={c.id} className="px-3 py-1.5 font-mono">
                  {row.key(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border bg-background/40 px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-xs", strong && "font-semibold")}>{value}</p>
    </div>
  );
}

/* ─── Detail artifact ─── */
function CardDetailArtifact({ output }: { output: unknown }) {
  const c = output as {
    id: string;
    nome: string;
    emissor: string;
    anuidade: number | string;
    lounge?: boolean;
    retornoFinanceiro?: { earning_summary?: string };
    valorEstimado?: CardItem["valorEstimado"];
    beneficiosAgrupados?: Record<string, string[]>;
    fonte?: string;
    fonteUrl?: string;
    cardArtUrl?: string;
    altText?: string;
  };
  if (!c?.id) return null;
  const hasImage = c.cardArtUrl && c.cardArtUrl !== "unknown";

  return (
    <div className="mt-2 rounded-xl border bg-card/60 p-3 text-xs">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-16 items-center justify-center rounded-lg border bg-zinc-950">
          {hasImage ? (
            <img
              src={c.cardArtUrl}
              alt={c.altText ?? c.nome}
              className="max-h-8 max-w-[52px] object-contain"
            />
          ) : (
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{c.nome}</p>
          <p className="text-[10px] text-muted-foreground">{c.emissor}</p>
        </div>
        <Link
          href={`/cartoes/${c.id}`}
          className="ml-auto shrink-0 rounded-lg border px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver mais
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-background/40 px-2.5 py-1.5">
          <p className="text-[10px] text-muted-foreground">Anuidade</p>
          <p className="font-mono font-medium">{feeLabel(c.anuidade)}</p>
        </div>
        <div className="rounded-lg border bg-background/40 px-2.5 py-1.5">
          <p className="text-[10px] text-muted-foreground">Lounge</p>
          <p className="font-mono font-medium">{hasLounge(c.lounge) ? "Sim" : "Não"}</p>
        </div>
      </div>

      {c.valorEstimado && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-background/40 px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground">Valor líquido</p>
            <p
              className={`font-mono font-medium ${
                (c.valorEstimado.valorLiquidoMensal ?? 0) >= 0
                  ? "text-emerald-500"
                  : "text-rose-500"
              }`}
            >
              {moneyLabel(c.valorEstimado.valorLiquidoMensal ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border bg-background/40 px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground">Retorno bruto</p>
            <p className="font-mono font-medium">
              {moneyLabel(c.valorEstimado.retornoBrutoMensal ?? 0)}
            </p>
          </div>
        </div>
      )}

      {c.retornoFinanceiro?.earning_summary && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          {c.retornoFinanceiro.earning_summary}
        </p>
      )}
    </div>
  );
}

/* ─── Tool artifact dispatcher ─── */
const TOOL_LOADING_LABELS: Record<string, string> = {
  filterCards: "Buscando cartões...",
  compareCards: "Comparando...",
  getCardDetail: "Carregando detalhes...",
  rankCardsForProfile: "Calculando ranking...",
};

function ToolArtifact({
  toolName,
  state,
  output,
}: {
  toolName: string;
  state: string;
  output?: unknown;
}) {
  const isLoading = state === "input-streaming" || state === "input";
  if (isLoading) {
    return (
      <p className="mt-1 text-xs text-muted-foreground animate-pulse">
        {TOOL_LOADING_LABELS[toolName] ?? "Processando..."}
      </p>
    );
  }

  if (!output) return null;

  if (toolName === "filterCards" || toolName === "rankCardsForProfile") {
    return <CardListArtifact output={output} />;
  }
  if (toolName === "compareCards") {
    return <CardCompareArtifact output={output} />;
  }
  if (toolName === "getCardDetail") {
    return <CardDetailArtifact output={output} />;
  }
  return null;
}

/* ─── Main component ─── */
export function ChatInterface({ variant = "full", className }: ChatInterfaceProps) {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ profile }),
    }),
  });
  const { profile, resetOnboarding } = useProfileStore();
  const [bestCardName, setBestCardName] = useState<string | null>(null);
  const isHero = variant === "hero";
  const isStreaming = status === "streaming" || status === "submitted";
  const [expanded, setExpanded] = useState(false);

  function handleSubmit(text: string) {
    if (!text.trim()) return;
    sendMessage({ text });
    setExpanded(false);
  }

  const visibleMessages =
    expanded || messages.length <= 2 ? messages : messages.slice(-2);
  const hiddenCount = messages.length - visibleMessages.length;

  const hasMessages = messages.length > 0;

  React.useEffect(() => {
    if (!profile?.currentPrimaryCardName) {
      setBestCardName(null);
      return;
    }

    let cancelled = false;
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const best = data.find(
          (item) => item?.card?.card_stable_id !== profile.currentPrimaryCardId
        );
        setBestCardName(best?.card?.display_name ?? null);
      })
      .catch(() => setBestCardName(null));

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const comparisonSuggestion =
    profile?.currentPrimaryCardName && bestCardName
      ? `Compare meu cartão atual, ${profile.currentPrimaryCardName}, com ${bestCardName} para o meu perfil. Quero saber se vale trocar, com números.`
      : null;

  return (
    <motion.div
      className={cn(
        "flex flex-col overflow-hidden",
        !isHero && "min-h-[520px] flex-1 sm:h-[calc(100vh-120px)]",
        className
      )}
      animate={isHero ? { height: hasMessages ? 500 : "auto" } : {}}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <AnimatePresence initial={false}>
        {hasMessages && (
          <motion.div
            key="conversation"
            className="flex-1 min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
      <Conversation className="h-full overflow-y-auto px-4">
        <ConversationContent className="mx-auto max-w-2xl py-5 space-y-3">
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ChevronUp className="h-3 w-3" />
              {hiddenCount} mensagen{hiddenCount !== 1 ? "s" : ""} anteriores
            </button>
          )}

          {(visibleMessages as UIMessage[]).map((message) => (
            <Message
              key={message.id}
              from={message.role === "user" ? "user" : "assistant"}
              className={message.role === "user" ? "justify-end" : ""}
            >
              <MessageContent
                className={
                  message.role === "user"
                    ? "max-w-[86%] rounded-2xl bg-muted px-3.5 py-2 sm:max-w-[78%]"
                    : "w-full"
                }
              >
                {message.parts.map((part, i) => {
                  if (isTextUIPart(part)) {
                    return message.role === "user" ? (
                      <span key={i} className="text-sm">{part.text}</span>
                    ) : (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    );
                  }
                  if (isToolUIPart(part)) {
                    const toolName = part.type.replace(/^tool-/, "");
                    const output = "output" in part ? part.output : undefined;
                    return (
                      <ToolArtifact
                        key={i}
                        toolName={toolName}
                        state={part.state as string}
                        output={output}
                      />
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {expanded && messages.length > 2 && (
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ChevronDown className="h-3 w-3" />
              Recolher
            </button>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="mx-auto max-w-2xl">
          <ChatPromptBox
            isLoading={isStreaming}
            onSubmit={handleSubmit}
            onStop={stop}
            onProfile={resetOnboarding}
            profileSet={!!profile}
            suggestion={comparisonSuggestion}
          />
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
            Dados podem conter imprecisões. Confirme com o emissor.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Prompt box ─── */
function ChatPromptBox({
  isLoading,
  onSubmit,
  onStop,
  onProfile,
  profileSet,
  suggestion,
}: {
  isLoading: boolean;
  onSubmit: (text: string) => void;
  onStop: () => void;
  onProfile: () => void;
  profileSet: boolean;
  suggestion?: string | null;
}) {
  const [value, setValue] = React.useState("");

  function handleSubmit() {
    onSubmit(value);
    setValue("");
  }

  return (
    <PromptInput
      value={value}
      onValueChange={setValue}
      isLoading={isLoading}
      onSubmit={handleSubmit}
    >
      {suggestion && !value && (
        <button
          type="button"
          onClick={() => onSubmit(suggestion)}
          className="mx-2 mt-2 rounded-xl border bg-card/70 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Sugerido: comparar meu cartão atual com a melhor recomendação
        </button>
      )}
      <PromptInputTextarea
        placeholder="Pergunte sobre cartões..."
        className="px-3 py-2.5 text-sm min-h-[42px]"
      />
      <PromptInputActions className="justify-between px-2 pb-2">
        <div className="flex items-center gap-1">
          <ActionButton
            tooltip={profileSet ? "Editar perfil" : "Configurar perfil"}
            onClick={onProfile}
            active={profileSet}
          >
            <UserRound className="h-4 w-4" />
          </ActionButton>
          <Link href="/cartoes" tabIndex={-1}>
            <ActionButton tooltip="Ver catálogo">
              <LayoutList className="h-4 w-4" />
            </ActionButton>
          </Link>
        </div>
        <PromptInputSubmit onStop={onStop} />
      </PromptInputActions>
    </PromptInput>
  );
}

function ActionButton({
  children,
  tooltip,
  onClick,
  active,
}: {
  children: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
        active
          ? "text-foreground/80 hover:text-foreground"
          : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30"
      )}
    >
      {children}
    </button>
  );
}
