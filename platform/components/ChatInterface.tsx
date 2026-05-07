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
import { CreditCard, ChevronDown, ChevronUp, ArrowUpRight, Check, Plus, History, Maximize2, X } from "lucide-react";
import Link from "next/link";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  variant?: "full" | "hero";
  className?: string;
}

const CHAT_HISTORY_KEY = "credit-card-chat-history";
const MAX_CHAT_HISTORY = 20;

interface ChatHistoryItem {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
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

function messageText(message: UIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join(" ")
    .trim();
}

function historyTitle(messages: UIMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser ? messageText(firstUser) : "Conversa";
  return text.length > 54 ? `${text.slice(0, 51)}...` : text || "Conversa";
}

function historyGroupLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function readChatHistory(): ChatHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHAT_HISTORY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ChatHistoryItem => {
        return (
          typeof item?.id === "string" &&
          typeof item?.title === "string" &&
          typeof item?.updatedAt === "number" &&
          Array.isArray(item?.messages)
        );
      })
      .slice(0, MAX_CHAT_HISTORY);
  } catch {
    return [];
  }
}

function writeChatHistory(history: ChatHistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_CHAT_HISTORY)));
}

function groupedHistory(history: ChatHistoryItem[]) {
  return history.reduce<Array<{ label: string; items: ChatHistoryItem[] }>>((groups, item) => {
    const label = historyGroupLabel(item.updatedAt);
    const group = groups.find((entry) => entry.label === label);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
    return groups;
  }, []);
}

function ChatMessageBubble({ message }: { message: UIMessage }) {
  return (
    <Message
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
  );
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

  const rows: { label: string; key: (c: CardItem) => string; numericKey?: (c: CardItem) => number | undefined }[] = [
    {
      label: "Valor líquido",
      key: (c) => c.valorEstimado?.valorLiquidoMensal !== undefined ? moneyLabel(c.valorEstimado.valorLiquidoMensal) : "—",
      numericKey: (c) => c.valorEstimado?.valorLiquidoMensal,
    },
    {
      label: "Retorno",
      key: (c) => c.valorEstimado?.retornoBrutoMensal !== undefined ? moneyLabel(c.valorEstimado.retornoBrutoMensal) : c.retornoFinanceiro?.earning_summary ?? "—",
      numericKey: (c) => c.valorEstimado?.retornoBrutoMensal,
    },
    {
      label: "Benefícios",
      key: (c) => {
        const v = c.valorEstimado?.beneficiosMensais ?? c.valorEstimado?.beneficiosIntangiveisMensais;
        return v !== undefined ? moneyLabel(v) : "—";
      },
      numericKey: (c) => c.valorEstimado?.beneficiosMensais ?? c.valorEstimado?.beneficiosIntangiveisMensais,
    },
    {
      label: "Anuidade efetiva",
      key: (c) => c.valorEstimado?.anuidadeEfetivaMensal !== undefined ? `-${moneyLabel(c.valorEstimado.anuidadeEfetivaMensal).replace("+", "")}` : feeLabel(c.anuidade),
      numericKey: (c) => c.valorEstimado?.anuidadeEfetivaMensal !== undefined ? -c.valorEstimado.anuidadeEfetivaMensal : undefined,
    },
    { label: "Anuidade", key: (c) => feeLabel(c.anuidade) },
    { label: "Lounge", key: (c) => (hasLounge(c.lounge) ? "Sim" : "Não") },
    { label: "Pontos", key: (c) => (c.pontos ? "Sim" : "Não") },
    { label: "Seg. viagem", key: (c) => (c.seguroViagem !== undefined ? (c.seguroViagem ? "Sim" : "Não") : "—") },
    { label: "Concierge", key: (c) => (c.concierge !== undefined ? (c.concierge ? "Sim" : "Não") : "—") },
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
              <MiniMetric label="Delta/mês" value={moneyLabel(delta.valorLiquidoMensal ?? 0)} numericValue={delta.valorLiquidoMensal} strong />
              <MiniMetric label="Delta/ano" value={`R$${Math.round(delta.valorLiquidoAnual ?? 0).toLocaleString("pt-BR")}`} numericValue={delta.valorLiquidoAnual} />
              <MiniMetric label="Retorno" value={moneyLabel(delta.retornoBrutoMensal ?? 0)} numericValue={delta.retornoBrutoMensal} />
              <MiniMetric label="Anuidade" value={moneyLabel(-(delta.anuidadeMensal ?? 0))} numericValue={-(delta.anuidadeMensal ?? 0)} />
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border text-xs">
        <table className="w-full min-w-[420px]">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="px-3 py-2 text-left font-normal text-muted-foreground">—</th>
            {cards.map((c) => {
              const isWinner = winner?.id === c.id;
              return (
                <th key={c.id} className={cn("px-3 py-2 text-left font-medium", isWinner && "text-emerald-400")}>
                  <Link href={`/cartoes/${c.id}`} className="hover:underline">
                    {c.nome}
                    {isWinner && <span className="ml-1 font-mono text-[9px] text-emerald-400/70">★</span>}
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b last:border-0 odd:bg-muted/5">
              <td className="px-3 py-1.5 text-muted-foreground">{row.label}</td>
              {cards.map((c) => {
                const num = row.numericKey?.(c);
                return (
                  <td key={c.id} className={cn("px-3 py-1.5 font-mono", row.numericKey ? moneyColor(num) : "")}>
                    {row.key(c)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

function moneyColor(value: number | undefined): string {
  if (value === undefined) return "";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function MiniMetric({ label, value, strong, numericValue }: { label: string; value: string; strong?: boolean; numericValue?: number }) {
  return (
    <div className="rounded-lg border bg-background/40 px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-xs", strong && "font-semibold", numericValue !== undefined && moneyColor(numericValue))}>{value}</p>
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
  const { profile, resetOnboarding } = useProfileStore();
  const profileRef = React.useRef(profile);
  const conversationIdRef = React.useRef<string | null>(null);
  const [history, setHistory] = React.useState<ChatHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = React.useState<ChatHistoryItem | null>(null);

  React.useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  React.useEffect(() => {
    setHistory(readChatHistory());
  }, []);

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });
  const [bestCardName, setBestCardName] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isHero = variant === "hero";
  const isStreaming = status === "streaming" || status === "submitted";
  const [expanded, setExpanded] = useState(false);

  function handleSubmit(text: string) {
    if (!text.trim()) return;
    conversationIdRef.current ??= `chat-${Date.now()}`;
    sendMessage(
      { text },
      {
        body: {
          profile: profileRef.current,
        },
      }
    );
    setExpanded(false);
    setIsFullscreen(true);
  }

  React.useEffect(() => {
    if (isStreaming || messages.length < 2 || !conversationIdRef.current) return;

    const nextItem: ChatHistoryItem = {
      id: conversationIdRef.current,
      title: historyTitle(messages as UIMessage[]),
      updatedAt: Date.now(),
      messages: messages as UIMessage[],
    };

    setHistory((current) => {
      const next = [
        nextItem,
        ...current.filter((item) => item.id !== nextItem.id),
      ].slice(0, MAX_CHAT_HISTORY);
      writeChatHistory(next);
      return next;
    });
  }, [isStreaming, messages]);

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

  const conversationContent = (
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
          <ChatMessageBubble key={message.id} message={message} />
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
  );

  return (
    <>
      {/* ── Compact view ── */}
      <motion.div
        className={cn(
          "flex flex-col overflow-hidden",
          !isHero && "min-h-[520px] flex-1 sm:h-[calc(100vh-120px)]",
          className
        )}
        animate={isHero ? { height: hasMessages ? 420 : "auto" } : {}}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <AnimatePresence initial={false}>
          {hasMessages && (
            <motion.div
              key="compact-convo"
              className="flex-1 min-h-0 opacity-60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {conversationContent}
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
              history={history}
              onOpenHistory={(item) => { setSelectedHistory(item); setIsFullscreen(true); }}
              onExpand={hasMessages ? () => setIsFullscreen(true) : undefined}
            />
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
              Dados podem conter imprecisões. Confirme com o emissor.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Fullscreen modal ── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-background"
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                {selectedHistory ? selectedHistory.title : "Chat"}
              </p>
              <button
                type="button"
                onClick={() => { setIsFullscreen(false); setSelectedHistory(null); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Conversation */}
            {selectedHistory ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4">
                <div className="mx-auto max-w-2xl space-y-3 py-5">
                  {selectedHistory.messages.map((msg) => (
                    <ChatMessageBubble key={msg.id} message={msg as UIMessage} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                {hasMessages ? conversationContent : (
                  <div className="flex h-full items-center justify-center">
                    <p className="font-mono text-[11px] text-muted-foreground/30">
                      Nenhuma mensagem ainda.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="shrink-0 px-4 pb-4 pt-2">
              {selectedHistory && (
                <p className="mx-auto mb-2 max-w-2xl font-mono text-[10px] text-muted-foreground/40">
                  Nova pergunta
                </p>
              )}
              <div className="mx-auto max-w-2xl">
                <ChatPromptBox
                  isLoading={isStreaming}
                  onSubmit={(text) => { setSelectedHistory(null); handleSubmit(text); }}
                  onStop={stop}
                  onProfile={resetOnboarding}
                  profileSet={!!profile}
                  suggestion={selectedHistory ? null : comparisonSuggestion}
                  history={history}
                  onOpenHistory={(item) => setSelectedHistory(item)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
  history,
  onOpenHistory,
  onExpand,
}: {
  isLoading: boolean;
  onSubmit: (text: string) => void;
  onStop: () => void;
  onProfile: () => void;
  profileSet: boolean;
  suggestion?: string | null;
  history: ChatHistoryItem[];
  onOpenHistory: (item: ChatHistoryItem) => void;
  onExpand?: () => void;
}) {
  const [value, setValue] = React.useState("");
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const groups = React.useMemo(() => groupedHistory(history), [history]);

  const chips = React.useMemo(() => {
    const list: { label: string; query: string }[] = [];
    if (suggestion) {
      list.push({ label: "Comparar com melhor alternativa", query: suggestion });
    }
    list.push(
      { label: "Isentar anuidade com investimento", query: "Quais cartões consigo isentar a anuidade com investimento? Me mostre quais e quanto preciso manter." }
    );
    return list;
  }, [suggestion]);

  function handleSubmit() {
    onSubmit(value);
    setValue("");
    setHistoryOpen(false);
  }

  return (
    <PromptInput
      value={value}
      onValueChange={setValue}
      isLoading={isLoading}
      onSubmit={handleSubmit}
    >
      {onExpand && (
        <div className="flex justify-end px-2 pt-2">
          <button
            type="button"
            onClick={onExpand}
            className="flex items-center gap-1 rounded-md border border-border/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground/50 transition-all hover:border-border/70 hover:text-muted-foreground"
          >
            <Maximize2 className="h-2.5 w-2.5" />
            Expandir
          </button>
        </div>
      )}
      {!value && !isLoading && (
        <div className="flex gap-1.5 overflow-x-auto px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => { onSubmit(chip.query); }}
              className="shrink-0 rounded-full border border-border/40 bg-transparent px-2.5 py-1 font-mono text-[10px] text-muted-foreground/60 transition-all hover:border-border/80 hover:text-muted-foreground whitespace-nowrap"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
      <PromptInputTextarea
        placeholder="Pergunte sobre cartões..."
        className="px-3 py-2.5 text-sm min-h-[42px]"
      />
      <PromptInputActions className="justify-between px-2 pb-2">
        <div className="relative flex items-center gap-1">
          {historyOpen && (
            <div className="absolute bottom-10 left-0 z-20 w-72 max-w-[calc(100vw-2.5rem)] rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl">
              <div className="mb-1 flex items-center justify-between px-1.5">
                <p className="text-xs font-medium">Histórico</p>
                <p className="text-[10px] text-muted-foreground">{history.length}</p>
              </div>
              {history.length ? (
                <div className="max-h-72 overflow-y-auto pr-1">
                  {groups.map((group) => (
                    <div key={group.label} className="mb-2 last:mb-0">
                      <p className="px-1.5 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onOpenHistory(item);
                              setHistoryOpen(false);
                            }}
                            className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
                          >
                            <p className="line-clamp-1 text-xs font-medium">{item.title}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {item.messages.length} mensagens ·{" "}
                              {new Date(item.updatedAt).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  As conversas aparecem aqui depois da primeira resposta.
                </p>
              )}
            </div>
          )}
          <ActionButton
            tooltip="Histórico"
            onClick={() => setHistoryOpen((open) => !open)}
            active={historyOpen}
          >
            <History className="h-4 w-4" />
          </ActionButton>
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
