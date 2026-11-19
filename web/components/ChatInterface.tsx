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
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputSubmit,
} from "@/components/ui/ai-prompt-box";
import { useCompareStore, useProfileStore } from "@/lib/store";
import { fetchRecommendations } from "@/lib/recommend-client";
import {
  Coins,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Check,
  Plus,
  History,
  Maximize2,
  ReceiptText,
  Plane,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import type { UIMessage } from "ai";
import type { FeeWaiverRule } from "@/types/cards";
import { feeWaiverRuleBadgeVariant, feeWaiverRuleDisplayLabel } from "@/lib/fee-waiver-badges";
import { CardArt, Tag } from "@/components/card";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  variant?: "full" | "hero";
  className?: string;
}

const CHAT_HISTORY_KEY = "credit-card-chat-history";
const ACTIVE_CHAT_SESSION_KEY = "cartaoideal-active-chat-session";
const MAX_CHAT_HISTORY = 20;

interface ActiveChatSession {
  variant: "full" | "hero";
  conversationId: string | null;
  messages: UIMessage[];
  isFullscreen: boolean;
  selectedHistory: ChatHistoryItem | null;
  scrollTop: number;
}

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
  regrasIsencao?: FeeWaiverRule[];
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

type Anuidade = number | string | null | undefined;

function hasLounge(lounge: CardItem["lounge"]) {
  return typeof lounge === "boolean" ? lounge : !!lounge?.has_lounge_access;
}

function moneyLabel(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}/mês`;
}

function isFree(anuidade: Anuidade) {
  return anuidade === 0 || anuidade === "free";
}

function feeLabel(anuidade: Anuidade) {
  if (anuidade === null || anuidade === undefined) return "—";
  if (isFree(anuidade)) return "Grátis";
  if (typeof anuidade === "number") return `R$${anuidade.toLocaleString("pt-BR")}/ano`;
  return String(anuidade);
}

function signTone(value: number | undefined): "default" | "positive" | "negative" {
  if (value === undefined || value === 0) return "default";
  return value > 0 ? "positive" : "negative";
}

function signClass(value: number | undefined) {
  const tone = signTone(value);
  if (tone === "positive") return "text-positive";
  if (tone === "negative") return "text-negative";
  return "";
}

function netMonthly(card: Pick<CardItem, "valorEstimado">) {
  const value = card?.valorEstimado?.valorLiquidoMensal;
  return typeof value === "number" ? value : undefined;
}

/** Index of the single highest value, or null when there is no clear best. */
function bestIndex(values: Array<number | undefined>): number | null {
  const defined = values.filter((value): value is number => typeof value === "number");
  if (defined.length < 2) return null;
  const max = Math.max(...defined);
  if (defined.filter((value) => value === max).length !== 1) return null;
  return values.indexOf(max);
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

function ChatMessageBubble({
  message,
  onNavigate,
}: {
  message: UIMessage;
  onNavigate?: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <Message
      from={isUser ? "user" : "assistant"}
      data-testid={isUser ? undefined : "chat-message-assistant"}
    >
      <MessageContent className={isUser ? "max-w-[86%] sm:max-w-[78%]" : "w-full"}>
        {message.parts.map((part, i) => {
          if (isTextUIPart(part)) {
            return isUser ? (
              <span key={i} className="text-[13.5px]">
                {part.text}
              </span>
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
                onNavigate={onNavigate}
              />
            );
          }
          return null;
        })}
      </MessageContent>
    </Message>
  );
}

/* ─── Mini card row used in condensed list artifacts ─── */
function MiniCard({
  card,
  rank,
  best,
  onNavigate,
}: {
  card: CardItem;
  rank?: number;
  best?: boolean;
  onNavigate?: () => void;
}) {
  const { ids, add, remove, canAdd } = useCompareStore();
  const selected = ids.includes(card.id);
  const badges = (card.regrasIsencao ?? []).slice(0, 2);
  const annualFeeHint = typeof card.anuidade === "number" ? card.anuidade : undefined;
  const net = netMonthly(card);
  const grossReturn = card.valorEstimado?.retornoBrutoMensal;

  const metaParts: string[] = [card.emissor];
  if (net !== undefined) {
    metaParts.push(
      isFree(card.anuidade) ? "Grátis" : `Anuidade ${feeLabel(card.anuidade).replace("/ano", "")}`
    );
  }
  if (typeof grossReturn === "number") {
    metaParts.push(`Retorno ${moneyLabel(grossReturn)}`);
  } else if (card.retornoFinanceiro?.earning_summary) {
    metaParts.push(card.retornoFinanceiro.earning_summary);
  }
  if (hasLounge(card.lounge)) {
    metaParts.push("Lounge");
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 transition-colors duration-100",
        best ? "bg-brand-wash/70" : "hover:bg-surface-2/60"
      )}
    >
      <Link
        href={`/cartoes/${card.id}`}
        onClick={onNavigate}
        className="group/mini flex min-w-0 flex-1 items-center gap-2.5"
      >
        {rank !== undefined && (
          <span
            className={cn(
              "num w-5 shrink-0 text-[11px] font-medium",
              best ? "font-semibold text-brand-accent" : "text-fg-3"
            )}
          >
            #{rank}
          </span>
        )}
        <CardArt
          artUrl={card.cardArtUrl}
          issuerRaw={card.emissor ?? ""}
          displayName={card.nome}
          compact
          decorative
          className="h-7 w-11"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold leading-tight text-fg group-hover/mini:underline">
              {card.nome}
            </span>
            <ArrowUpRight className="h-3 w-3 shrink-0 text-fg-3" />
          </div>
          <p className="num truncate text-[11px] text-fg-3">{metaParts.join(" · ")}</p>
          {(best || card.pontuacao !== undefined || badges.length > 0) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {best && (
                <Tag variant="brand" className="bg-raised px-1.5 py-0 text-[10px]">
                  Melhor
                </Tag>
              )}
              {card.pontuacao !== undefined && (
                <Tag variant="quiet" className="px-1.5 py-0 text-[10px]">
                  <span className="num">
                    {card.pontuacao}
                    {net !== undefined ? "/100" : "pts"}
                  </span>
                </Tag>
              )}
              {badges.map((rule, index) => (
                <Tag
                  key={`${rule.category}-${rule.threshold_brl ?? index}`}
                  variant={
                    feeWaiverRuleBadgeVariant(rule, annualFeeHint) === "paid_fee_default"
                      ? "outline"
                      : "positive"
                  }
                  className="px-1.5 py-0 text-[10px]"
                >
                  {feeWaiverRuleDisplayLabel(rule, annualFeeHint)}
                </Tag>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          {net !== undefined ? (
            <span
              className={cn(
                "num block whitespace-nowrap text-sm font-semibold",
                signTone(net) === "negative"
                  ? "text-danger-text"
                  : signTone(net) === "positive" || best
                    ? "text-success-text"
                    : "text-fg"
              )}
            >
              {moneyLabel(net)}
            </span>
          ) : (
            <span
              className={cn(
                "num block whitespace-nowrap text-xs font-semibold",
                isFree(card.anuidade) ? "text-success-text" : "text-fg"
              )}
            >
              {feeLabel(card.anuidade)}
            </span>
          )}
          <span className="block text-[10px] text-fg-3">
            {net !== undefined ? "líq./mês" : "anuidade"}
          </span>
        </div>
      </Link>
      <button
        type="button"
        title={selected ? "Remover da comparação" : "Adicionar à comparação"}
        disabled={!selected && !canAdd()}
        onClick={() => (selected ? remove(card.id) : add({ id: card.id, name: card.nome }))}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-100 disabled:opacity-50",
          selected
            ? "border-brand-border bg-brand-wash text-brand-accent"
            : "border-line-strong bg-page text-fg-2 hover:bg-surface-2 hover:text-fg"
        )}
      >
        {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      </button>
    </div>
  );
}

/* ─── Card list artifact ─── */
function CardListArtifact({ output, onNavigate }: { output: unknown; onNavigate?: () => void }) {
  const cards = Array.isArray(output) ? (output as CardItem[]) : [];
  if (!cards.length) return null;
  const best = bestIndex(cards.map(netMonthly));
  return (
    <div className="mt-1.5 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
      {cards.map((c, i) => (
        <MiniCard
          key={c.id}
          card={c}
          rank={c.pontuacao !== undefined ? i + 1 : undefined}
          best={best === i}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

/* ─── Compare artifact ─── */
function CardCompareArtifact({ output, onNavigate }: { output: unknown; onNavigate?: () => void }) {
  const payload = output as
    | {
        cards?: CardItem[];
        delta?: {
          valorLiquidoMensal?: number;
          valorLiquidoAnual?: number;
          retornoBrutoMensal?: number;
          anuidadeMensal?: number;
          beneficiosMensais?: number;
          origemRetorno?: string | null;
        } | null;
        vencedor?: { id?: string; nome?: string } | null;
        perfilUsado?: unknown;
        naoEncontrados?: string[];
      }
    | CardItem[];
  const cards = Array.isArray(payload) ? payload : (payload?.cards ?? []);
  if (cards.length < 2) return null;
  const delta = !Array.isArray(payload) ? payload.delta : null;
  const namedWinnerId = !Array.isArray(payload) ? payload.vencedor?.id : undefined;
  const winner =
    (namedWinnerId ? cards.find((c) => c.id === namedWinnerId) : undefined) ??
    (cards[1]?.valorEstimado?.valorLiquidoMensal !== undefined &&
    cards[0]?.valorEstimado?.valorLiquidoMensal !== undefined
      ? delta?.valorLiquidoMensal && delta.valorLiquidoMensal > 0
        ? cards[1]
        : cards[0]
      : null);

  const rows: {
    label: string;
    key: (c: CardItem) => string;
    numericKey?: (c: CardItem) => number | undefined;
  }[] = [
    {
      label: "Retorno",
      key: (c) =>
        c.valorEstimado?.retornoBrutoMensal !== undefined
          ? moneyLabel(c.valorEstimado.retornoBrutoMensal)
          : (c.retornoFinanceiro?.earning_summary ?? "—"),
      numericKey: (c) => c.valorEstimado?.retornoBrutoMensal,
    },
    {
      label: "Benefícios",
      key: (c) => {
        const v =
          c.valorEstimado?.beneficiosMensais ?? c.valorEstimado?.beneficiosIntangiveisMensais;
        return v !== undefined ? moneyLabel(v) : "—";
      },
      numericKey: (c) =>
        c.valorEstimado?.beneficiosMensais ?? c.valorEstimado?.beneficiosIntangiveisMensais,
    },
    {
      label: "Anuidade",
      key: (c) => {
        const ef = c.valorEstimado?.anuidadeEfetivaMensal;
        if (ef !== undefined) {
          return ef === 0
            ? "Grátis"
            : `-${moneyLabel(ef).replace("+", "")} (${feeLabel(c.anuidade)})`;
        }
        return feeLabel(c.anuidade);
      },
      numericKey: (c) =>
        c.valorEstimado?.anuidadeEfetivaMensal !== undefined
          ? -c.valorEstimado.anuidadeEfetivaMensal
          : isFree(c.anuidade)
            ? 0
            : typeof c.anuidade === "number"
              ? -c.anuidade
              : undefined,
    },
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
    <div className="mt-1.5 space-y-2">
      {(delta || winner) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-brand-border bg-brand-wash px-3 py-2 text-xs">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {winner && (
              <>
                <span className="text-fg-2">Melhor:</span>
                <strong className="font-semibold text-fg">{winner.nome}</strong>
              </>
            )}
          </div>
          {delta && (
            <div className="num flex flex-wrap items-center gap-2 font-semibold">
              <span className={signClass(delta.valorLiquidoMensal)}>
                {moneyLabel(delta.valorLiquidoMensal ?? 0)}
              </span>
              <span className="text-fg-3">·</span>
              <span className={signClass(delta.valorLiquidoAnual)}>
                {`R$ ${Math.round(delta.valorLiquidoAnual ?? 0).toLocaleString("pt-BR")}/ano`}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-panel border border-line bg-surface text-xs">
        <table className="w-full min-w-[380px] border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-2 align-top">
              <th className="w-24 px-2.5 py-2 text-left text-[11px] font-medium text-fg-3">
                Critério
              </th>
              {cards.map((c) => {
                const isWinner = winner?.id === c.id;
                const net = netMonthly(c);
                return (
                  <th key={c.id} className="px-2.5 py-2 text-left font-normal">
                    <Link
                      href={`/cartoes/${c.id}`}
                      onClick={onNavigate}
                      className="group/cmp flex items-center gap-2"
                    >
                      <CardArt
                        artUrl={c.cardArtUrl}
                        issuerRaw={c.emissor ?? ""}
                        displayName={c.nome}
                        compact
                        decorative
                        className="h-6 w-9"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1 text-xs font-semibold leading-tight text-fg group-hover/cmp:underline">
                          <span>{c.nome}</span>
                          {isWinner && (
                            <Tag variant="brand" className="px-1.5 py-0 text-[10px]">
                              Melhor
                            </Tag>
                          )}
                        </span>
                        <span className="block text-[11px] text-fg-3">{c.emissor}</span>
                      </span>
                    </Link>
                    <p
                      className={cn(
                        "num mt-1 whitespace-nowrap text-sm font-semibold",
                        net !== undefined
                          ? signTone(net) === "negative"
                            ? "text-danger-text"
                            : signTone(net) === "positive" || isWinner
                              ? "text-success-text"
                              : "text-fg"
                          : "text-fg"
                      )}
                    >
                      {net !== undefined ? moneyLabel(net) : feeLabel(c.anuidade)}
                    </p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const best = row.numericKey ? bestIndex(cards.map(row.numericKey)) : null;
              return (
                <tr key={row.label} className="border-b border-line last:border-0">
                  <td className="px-2.5 py-1.5 text-fg-2">{row.label}</td>
                  {cards.map((c, i) => (
                    <td key={c.id} className="ledger-col px-2.5 py-1.5 text-fg">
                      <span
                        className={cn(
                          best === i &&
                            "inline-flex rounded-full bg-success-tint px-1.5 py-0.5 font-semibold text-success-text"
                        )}
                      >
                        {row.key(c)}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Detail artifact ─── */
function CardDetailArtifact({ output, onNavigate }: { output: unknown; onNavigate?: () => void }) {
  const c = output as {
    id: string;
    nome: string;
    emissor: string;
    anuidade: number | string;
    lounge?: boolean;
    retornoFinanceiro?: { earning_summary?: string };
    valorEstimado?: CardItem["valorEstimado"];
    cardArtUrl?: string;
  };
  if (!c?.id) return null;
  const net = c.valorEstimado ? (c.valorEstimado.valorLiquidoMensal ?? 0) : undefined;

  const metaParts: string[] = [c.emissor];
  if (net !== undefined) metaParts.push(`Anuidade ${feeLabel(c.anuidade)}`);
  if (c.valorEstimado) {
    metaParts.push(`Retorno ${moneyLabel(c.valorEstimado.retornoBrutoMensal ?? 0)}`);
  }
  metaParts.push(`Lounge ${hasLounge(c.lounge) ? "Sim" : "Não"}`);

  return (
    <Link
      href={`/cartoes/${c.id}`}
      onClick={onNavigate}
      className="group/det mt-1.5 flex items-center gap-2.5 rounded-panel border border-line bg-surface px-3 py-2.5 transition-colors duration-100 hover:bg-surface-2"
    >
      <CardArt
        artUrl={c.cardArtUrl}
        issuerRaw={c.emissor ?? ""}
        displayName={c.nome}
        compact
        decorative
        className="h-8 w-12"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[13px] font-semibold leading-tight text-fg group-hover/det:underline">
          <span className="truncate">{c.nome}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-fg-3" />
        </p>
        <p className="num truncate text-[11px] text-fg-3">{metaParts.join(" · ")}</p>
        {c.retornoFinanceiro?.earning_summary && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-fg-2">
            {c.retornoFinanceiro.earning_summary}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span
          className={cn(
            "num block whitespace-nowrap text-sm font-semibold",
            net !== undefined
              ? net >= 0
                ? "text-success-text"
                : "text-danger-text"
              : isFree(c.anuidade)
                ? "text-success-text"
                : "text-fg"
          )}
        >
          {net !== undefined ? moneyLabel(net) : feeLabel(c.anuidade)}
        </span>
        <span className="block text-[10px] text-fg-3">
          {net !== undefined ? "valor líq." : "anuidade"}
        </span>
      </div>
    </Link>
  );
}

/* ─── Investment waiver artifact ─── */
interface WaiverCardItem {
  id: string;
  nome: string;
  emissor: string;
  anuidade: number | string;
  textoIsencao: string;
  regrasIsencao?: FeeWaiverRule[];
  viaGasto: boolean;
  isGratuito: boolean;
  cardArtUrl?: string;
  altText?: string;
  thresholdInvestimento?: number;
  faltam?: number;
}

function waiverRuleLabel(rule: FeeWaiverRule) {
  if (rule.category === "monthly_spend" && typeof rule.threshold_brl === "number") {
    return `Gasto R$${rule.threshold_brl.toLocaleString("pt-BR")}/mês`;
  }
  if (rule.category === "investment" && typeof rule.threshold_brl === "number") {
    return `Invest. R$${rule.threshold_brl.toLocaleString("pt-BR")}`;
  }
  if (rule.category === "cashback" && typeof rule.threshold_brl === "number") {
    return `Cashback R$${rule.threshold_brl.toLocaleString("pt-BR")}/mês`;
  }
  return rule.description;
}

function WaiverMiniCard({
  card,
  faltam,
  onNavigate,
}: {
  card: WaiverCardItem;
  faltam?: number;
  onNavigate?: () => void;
}) {
  const visibleRules = (card.regrasIsencao ?? []).slice(0, 2);
  return (
    <Link
      href={`/cartoes/${card.id}`}
      onClick={onNavigate}
      className="group/waiver flex items-center gap-2.5 px-3 py-2 transition-colors duration-100 hover:bg-surface-2/60"
    >
      <CardArt
        artUrl={card.cardArtUrl}
        issuerRaw={card.emissor ?? ""}
        displayName={card.nome}
        compact
        decorative
        className="h-7 w-11"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[13px] font-semibold leading-tight text-fg group-hover/waiver:underline">
            {card.nome}
          </span>
          <ArrowUpRight className="h-3 w-3 shrink-0 text-fg-3" />
        </div>
        <p className="truncate text-[11px] text-fg-3">{card.emissor}</p>
        {visibleRules.length > 0 && (
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            {visibleRules.map((rule, index) => {
              const Icon =
                rule.category === "investment"
                  ? WalletCards
                  : rule.category === "cashback"
                    ? Coins
                    : rule.category === "miles"
                      ? Plane
                      : ReceiptText;
              return (
                <Tag
                  key={`${rule.category}-${rule.threshold_brl ?? index}`}
                  variant="outline"
                  className="min-w-0 max-w-full shrink px-1.5 py-0 text-[10px]"
                >
                  <Icon className="h-2.5 w-2.5 shrink-0" />
                  <span className="num truncate">{waiverRuleLabel(rule)}</span>
                </Tag>
              );
            })}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span
          className={cn(
            "num block whitespace-nowrap text-xs font-semibold",
            isFree(card.anuidade) ? "text-success-text" : "text-fg"
          )}
        >
          {feeLabel(card.anuidade)}
        </span>
        {faltam !== undefined ? (
          <span className="num block text-[10px] text-fg-3">
            +R$ {faltam.toLocaleString("pt-BR")}
          </span>
        ) : (
          <span className="block text-[10px] font-medium text-success-text">Acessível</span>
        )}
      </div>
    </Link>
  );
}

const WAIVER_COLLAPSED_LIMIT = 6;

function WaiverGroupList({
  title,
  items,
  showFaltam,
  onNavigate,
}: {
  title: string;
  items: WaiverCardItem[];
  showFaltam?: boolean;
  onNavigate?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, WAIVER_COLLAPSED_LIMIT);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-fg-3">
        {title} <span className="num">({items.length})</span>
      </p>
      <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
        {visible.map((c) => (
          <WaiverMiniCard
            key={c.id}
            card={c}
            faltam={showFaltam ? c.faltam : undefined}
            onNavigate={onNavigate}
          />
        ))}
        {items.length > WAIVER_COLLAPSED_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="w-full px-3 py-1.5 text-center text-[11px] font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {showAll ? "Mostrar menos" : `Ver mais ${hiddenCount} cartões`}
          </button>
        )}
      </div>
    </div>
  );
}

function InvestmentWaiverArtifact({
  output,
  onNavigate,
}: {
  output: unknown;
  onNavigate?: () => void;
}) {
  const data = output as {
    totalEncontrado?: number;
    investidoUsuario?: number;
    acessiveisAgora?: WaiverCardItem[];
    precisamDeMaisInvestimento?: WaiverCardItem[];
    cartoes?: WaiverCardItem[];
  };
  if (!data?.totalEncontrado) return null;

  const accessible = data.acessiveisAgora ?? [];
  const needsMore = data.precisamDeMaisInvestimento ?? [];
  const flat = data.cartoes;

  if (flat) {
    return (
      <div className="mt-1.5 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
        {flat.map((c) => (
          <WaiverMiniCard key={c.id} card={c} onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  const nearby = needsMore.filter((c) => (c.faltam ?? Infinity) <= 100_000);

  return (
    <div className="mt-1.5 space-y-2.5">
      {accessible.length > 0 && (
        <WaiverGroupList title="Acessíveis agora" items={accessible} onNavigate={onNavigate} />
      )}
      {nearby.length > 0 && (
        <WaiverGroupList
          title="Precisam de mais investimento"
          items={nearby}
          showFaltam
          onNavigate={onNavigate}
        />
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
  getInvestmentWaiverCards: "Buscando cartões com isenção por investimento...",
};

function ToolArtifact({
  toolName,
  state,
  output,
  onNavigate,
}: {
  toolName: string;
  state: string;
  output?: unknown;
  onNavigate?: () => void;
}) {
  const isLoading = state === "input-streaming" || state === "input";
  if (isLoading) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {TOOL_LOADING_LABELS[toolName] ?? "Processando..."}
      </p>
    );
  }

  if (!output) return null;

  if (toolName === "filterCards" || toolName === "rankCardsForProfile") {
    return <CardListArtifact output={output} onNavigate={onNavigate} />;
  }
  if (toolName === "compareCards") {
    return <CardCompareArtifact output={output} onNavigate={onNavigate} />;
  }
  if (toolName === "getCardDetail") {
    return <CardDetailArtifact output={output} onNavigate={onNavigate} />;
  }
  if (toolName === "getInvestmentWaiverCards") {
    return <InvestmentWaiverArtifact output={output} onNavigate={onNavigate} />;
  }
  return null;
}

const QUIET_BUTTON =
  "flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground";

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

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });
  const [bestCardName, setBestCardName] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isHero = variant === "hero";
  const isStreaming = status === "streaming" || status === "submitted";
  const [expanded, setExpanded] = useState(false);
  const restoredSessionRef = React.useRef(false);
  const historyScrollRef = React.useRef<HTMLDivElement | null>(null);
  const convoContainerRef = React.useRef<HTMLDivElement | null>(null);

  const persistActiveSession = React.useCallback(
    (scrollTopOverride?: number) => {
      if (typeof window === "undefined") return;
      const scrollEl =
        selectedHistory && historyScrollRef.current
          ? historyScrollRef.current
          : (convoContainerRef.current?.querySelector<HTMLElement>("[role='log']") ??
            convoContainerRef.current);
      const scrollTop = scrollTopOverride ?? scrollEl?.scrollTop ?? 0;
      const payload: ActiveChatSession = {
        variant,
        conversationId: conversationIdRef.current,
        messages: messages as UIMessage[],
        isFullscreen,
        selectedHistory,
        scrollTop,
      };
      try {
        window.sessionStorage.setItem(ACTIVE_CHAT_SESSION_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage quota errors
      }
    },
    [isFullscreen, messages, selectedHistory, variant]
  );

  React.useEffect(() => {
    if (restoredSessionRef.current) return;
    restoredSessionRef.current = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(ACTIVE_CHAT_SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as ActiveChatSession;
      if (saved.variant !== variant) return;
      if (!saved.messages.length && !saved.selectedHistory) return;
      conversationIdRef.current = saved.conversationId;
      if (saved.messages.length) {
        setMessages(saved.messages);
        setExpanded(true);
      }
      if (saved.selectedHistory) {
        setSelectedHistory(saved.selectedHistory);
      }
      if (saved.isFullscreen) {
        setIsFullscreen(true);
      }
      if (saved.scrollTop > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const target = saved.selectedHistory
              ? historyScrollRef.current
              : (convoContainerRef.current?.querySelector<HTMLElement>("[role='log']") ??
                convoContainerRef.current);
            if (target) target.scrollTop = saved.scrollTop;
          });
        });
      }
    } catch {
      // Ignore malformed sessionStorage
    }
  }, [setMessages, variant]);

  React.useEffect(() => {
    if (!restoredSessionRef.current || isStreaming) return;
    if (!messages.length && !selectedHistory) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(ACTIVE_CHAT_SESSION_KEY);
      }
      return;
    }
    persistActiveSession();
  }, [isStreaming, messages, persistActiveSession, selectedHistory]);

  function handleResetConversation() {
    conversationIdRef.current = null;
    setMessages([]);
    setSelectedHistory(null);
    setExpanded(false);
    setIsFullscreen(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ACTIVE_CHAT_SESSION_KEY);
    }
  }

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
      const next = [nextItem, ...current.filter((item) => item.id !== nextItem.id)].slice(
        0,
        MAX_CHAT_HISTORY
      );
      writeChatHistory(next);
      return next;
    });
  }, [isStreaming, messages]);

  const visibleMessages = expanded || messages.length <= 2 ? messages : messages.slice(-2);
  const hiddenCount = messages.length - visibleMessages.length;

  const hasMessages = messages.length > 0;

  React.useEffect(() => {
    if (!profile?.currentPrimaryCardName) {
      setBestCardName(null);
      return;
    }

    let cancelled = false;
    fetchRecommendations(profile)
      .then(({ scores }) => {
        if (cancelled) return;
        const best = scores.find(
          (item) => item.card.card_stable_id !== profile.currentPrimaryCardId
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
    <div ref={convoContainerRef} className="h-full min-h-0">
      <Conversation className="h-full overflow-y-auto px-3 sm:px-4">
        <ConversationContent className="mx-auto max-w-2xl gap-3 px-0 py-3">
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setExpanded(true)} className={QUIET_BUTTON}>
              <ChevronUp className="h-3 w-3" />
              {hiddenCount} mensagen{hiddenCount !== 1 ? "s" : ""} anteriores
            </button>
          )}
          {(visibleMessages as UIMessage[]).map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              onNavigate={() => persistActiveSession()}
            />
          ))}
          {isStreaming && (
            <div
              data-testid="chat-loading"
              role="status"
              aria-label="Carregando"
              className="flex items-center gap-2 py-1 text-xs text-fg-3"
            >
              <BrandMark animated className="h-4 w-5" />
              <span>Analisando…</span>
            </div>
          )}
          {expanded && messages.length > 2 && (
            <button type="button" onClick={() => setExpanded(false)} className={QUIET_BUTTON}>
              <ChevronDown className="h-3.5 w-3.5" />
              Recolher
            </button>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );

  return (
    <>
      {/* ── Main / Compact view ── */}
      <motion.div
        className={cn(
          "flex flex-col overflow-hidden",
          !isHero && "min-h-[520px] flex-1 sm:min-h-0",
          className
        )}
        animate={isHero ? { height: hasMessages ? 420 : "auto" } : {}}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <AnimatePresence initial={false}>
          {hasMessages && (
            <motion.div
              key="compact-convo"
              className="min-h-0 flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {conversationContent}
            </motion.div>
          )}
        </AnimatePresence>
        <div className={cn("shrink-0 pb-2 pt-1", !isHero && "px-4 pb-5 pt-2 sm:px-6")}>
          <div className={cn("mx-auto", isHero ? "w-full" : "max-w-[768px]")}>
            <ChatPromptBox
              isLoading={isStreaming}
              onSubmit={handleSubmit}
              onStop={stop}
              onProfile={resetOnboarding}
              profileSet={!!profile}
              suggestion={comparisonSuggestion}
              history={history}
              onOpenHistory={(item) => {
                setSelectedHistory(item);
                setIsFullscreen(true);
              }}
              onExpand={hasMessages ? () => setIsFullscreen(true) : undefined}
            />
            <p className="mt-2.5 text-center text-xs text-fg-3">
              Dados podem conter imprecisões. Confirme as condições diretamente com o emissor.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Fullscreen modal ── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-page text-fg"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-page px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandMark className="h-4 w-5" />
                <p className="min-w-0 truncate text-sm font-semibold text-fg">
                  {selectedHistory ? selectedHistory.title : "Assistente de Cartões"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {(hasMessages || selectedHistory) && (
                  <button
                    type="button"
                    onClick={handleResetConversation}
                    className="h-8 rounded-full border border-line bg-page px-3 text-xs font-medium text-fg-2 transition-colors duration-100 hover:bg-surface hover:text-fg"
                  >
                    Nova conversa
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Fechar conversa"
                  onClick={() => {
                    setIsFullscreen(false);
                    setSelectedHistory(null);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-page text-fg-2 transition-colors duration-100 hover:bg-surface hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Conversation */}
            {selectedHistory ? (
              <div ref={historyScrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-4">
                <div className="mx-auto flex max-w-[768px] flex-col gap-3 py-3">
                  {selectedHistory.messages.map((msg) => (
                    <ChatMessageBubble
                      key={msg.id}
                      message={msg as UIMessage}
                      onNavigate={() => persistActiveSession()}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                {hasMessages ? (
                  conversationContent
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-fg-3">Nenhuma mensagem ainda.</p>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="shrink-0 px-4 pb-5 pt-2 sm:px-6">
              {selectedHistory && (
                <p className="mx-auto mb-2 max-w-[768px] text-xs font-medium text-fg-3">
                  Nova pergunta
                </p>
              )}
              <div className="mx-auto max-w-[768px]">
                <ChatPromptBox
                  isLoading={isStreaming}
                  onSubmit={(text) => {
                    setSelectedHistory(null);
                    handleSubmit(text);
                  }}
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

const CHIP =
  "flex h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-fg-2 transition-colors duration-100 hover:border-line-strong hover:bg-surface-2 hover:text-fg";

/* ─── Prompt box ─── */
function ChatPromptBox({
  isLoading,
  onSubmit,
  onStop,
  onProfile: _onProfile,
  profileSet: _profileSet,
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
  const historyButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [historyLayer, setHistoryLayer] = React.useState<{
    left: number;
    bottom: number;
    width: number;
  } | null>(null);
  const groups = React.useMemo(() => groupedHistory(history), [history]);

  React.useEffect(() => {
    if (!historyOpen) return;

    const updateLayer = () => {
      const trigger = historyButtonRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = globalThis.window.innerWidth;
      const width = Math.min(288, Math.max(220, viewportWidth - 24));
      const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12));
      const bottom = Math.max(12, globalThis.window.innerHeight - rect.top + 8);
      setHistoryLayer({ left, bottom, width });
    };

    updateLayer();
    globalThis.window.addEventListener("resize", updateLayer);
    globalThis.window.addEventListener("scroll", updateLayer, true);
    return () => {
      globalThis.window.removeEventListener("resize", updateLayer);
      globalThis.window.removeEventListener("scroll", updateLayer, true);
    };
  }, [historyOpen]);

  const chips = React.useMemo(() => {
    const list: { label: string; query: string }[] = [];
    if (suggestion) {
      list.push({
        label: "Comparar com melhor alternativa",
        query: suggestion,
      });
    }
    list.push({
      label: "Isentar anuidade com investimento",
      query:
        "Quais cartões consigo isentar a anuidade com investimento? Me mostre quais e quanto preciso manter.",
    });
    return list;
  }, [suggestion]);

  function handleSubmit() {
    onSubmit(value);
    setValue("");
    setHistoryOpen(false);
  }

  return (
    <div className="space-y-2.5">
      <PromptInput
        value={value}
        onValueChange={setValue}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className={cn(historyOpen && "relative z-90")}
      >
        <PromptInputTextarea
          placeholder="Pergunte sobre cartões..."
          className="min-h-[48px] px-4 py-3.5 text-base md:text-[15px]"
        />
        <PromptInputActions className="justify-between px-3 pb-2.5">
          <div className={cn("relative flex items-center gap-1.5", historyOpen && "z-90")}>
            {historyOpen && historyLayer && (
              <div
                className="fixed z-[130] rounded-panel border border-line bg-raised p-2.5 text-fg shadow-menu"
                style={{
                  left: historyLayer.left,
                  bottom: historyLayer.bottom,
                  width: historyLayer.width,
                  maxWidth: "calc(100vw - 1.5rem)",
                }}
              >
                <div className="mb-1.5 flex items-center justify-between px-2">
                  <p className="text-xs font-semibold text-fg">Histórico</p>
                  <p className="num text-xs text-fg-3">{history.length}</p>
                </div>
                {history.length ? (
                  <div className="max-h-64 overflow-y-auto">
                    {groups.map((group) => (
                      <div key={group.label} className="mb-2 last:mb-0">
                        <p className="px-2 py-1 text-xs font-medium text-fg-3">{group.label}</p>
                        <div>
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                onOpenHistory(item);
                                setHistoryOpen(false);
                              }}
                              className="w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-100 hover:bg-surface"
                            >
                              <p className="line-clamp-1 text-xs font-semibold text-fg">
                                {item.title}
                              </p>
                              <p className="num mt-0.5 text-xs text-fg-3">
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
                  <p className="px-2 py-3 text-xs text-fg-3">
                    As conversas aparecem aqui depois da primeira resposta.
                  </p>
                )}
              </div>
            )}
            <ActionButton
              tooltip="Histórico"
              onClick={() => setHistoryOpen((open) => !open)}
              active={historyOpen}
              buttonRef={historyButtonRef}
            >
              <History className="h-4 w-4" />
            </ActionButton>
            {onExpand && (
              <button type="button" onClick={onExpand} className={CHIP}>
                <Maximize2 className="h-3.5 w-3.5" />
                Expandir
              </button>
            )}
          </div>
          <PromptInputSubmit onStop={onStop} />
        </PromptInputActions>
      </PromptInput>

      {!value && !isLoading && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                onSubmit(chip.query);
              }}
              className={CHIP}
            >
              <span className="truncate">{chip.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  tooltip,
  onClick,
  active,
  buttonRef,
}: {
  children: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  active?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      title={tooltip}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-100",
        active ? "bg-surface-2 text-fg" : "text-fg-2 hover:bg-surface hover:text-fg"
      )}
    >
      {children}
    </button>
  );
}
