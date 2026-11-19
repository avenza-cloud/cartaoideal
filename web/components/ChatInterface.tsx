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
import { CardArt, DataRow, LeadFact, type Stat, StatRow, Tag } from "@/components/card";
import { BrandMark } from "@/components/BrandMark";
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

function ChatMessageBubble({ message }: { message: UIMessage }) {
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
              <span key={i} className="text-sm">
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
              />
            );
          }
          return null;
        })}
      </MessageContent>
    </Message>
  );
}

/* ─── Mini card used in list artifacts ─── */
function MiniCard({ card, rank, best }: { card: CardItem; rank?: number; best?: boolean }) {
  const { ids, add, remove, canAdd } = useCompareStore();
  const selected = ids.includes(card.id);
  const badges = (card.regrasIsencao ?? []).slice(0, 3);
  const annualFeeHint = typeof card.anuidade === "number" ? card.anuidade : undefined;
  const net = netMonthly(card);
  const grossReturn = card.valorEstimado?.retornoBrutoMensal;

  // The fee leads when there is no estimate, so it is not repeated below.
  const stats: Stat[] = [];
  if (net !== undefined) {
    stats.push({
      label: "Anuidade",
      value: feeLabel(card.anuidade),
      tone: isFree(card.anuidade) ? "positive" : "default",
    });
  }
  stats.push(
    {
      label: "Retorno",
      value:
        typeof grossReturn === "number"
          ? moneyLabel(grossReturn)
          : (card.retornoFinanceiro?.earning_summary ?? "—"),
    },
    { label: "Lounge", value: hasLounge(card.lounge) ? "Sim" : "Não" }
  );

  return (
    <div
      className={cn(
        "rounded-panel p-4 transition-colors duration-100",
        best ? "border border-brand-border bg-brand-wash" : "bg-surface"
      )}
    >
      <Link
        href={`/cartoes/${card.id}`}
        className="group/mini flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {rank !== undefined && (
            <span
              className={cn(
                "num shrink-0 text-xs font-medium",
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
            className="h-10 w-16"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-snug text-fg">
              <span className="truncate group-hover/mini:underline">{card.nome}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-fg-3" />
            </p>
            <p className="truncate text-xs text-fg-3">{card.emissor}</p>
          </div>
        </div>
        {net !== undefined ? (
          <LeadFact
            value={moneyLabel(net)}
            label="Valor líquido"
            marked={best}
            tone={signTone(net)}
            size="sm"
            className="shrink-0 sm:text-right"
          />
        ) : (
          <LeadFact
            value={feeLabel(card.anuidade)}
            label="Anuidade"
            tone={isFree(card.anuidade) ? "positive" : "default"}
            size="sm"
            className="shrink-0 sm:text-right"
          />
        )}
      </Link>

      <StatRow stats={stats} className="mt-3" />

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {best && (
            <Tag variant="brand" className="bg-raised">
              Melhor escolha
            </Tag>
          )}
          {card.pontuacao !== undefined && (
            <Tag variant="quiet">
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
            >
              {feeWaiverRuleDisplayLabel(rule, annualFeeHint)}
            </Tag>
          ))}
        </div>
        <button
          type="button"
          title={selected ? "Remover da comparação" : "Adicionar à comparação"}
          disabled={!selected && !canAdd()}
          onClick={() => (selected ? remove(card.id) : add({ id: card.id, name: card.nome }))}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-100 disabled:opacity-50",
            selected
              ? "border-brand-border bg-brand-wash text-brand-accent"
              : "border-line-strong bg-page text-fg-2 hover:bg-surface-2 hover:text-fg"
          )}
        >
          {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

/* ─── Card list artifact ─── */
function CardListArtifact({ output }: { output: unknown }) {
  const cards = Array.isArray(output) ? (output as CardItem[]) : [];
  if (!cards.length) return null;
  const best = bestIndex(cards.map(netMonthly));
  return (
    <div className="mt-2 space-y-2">
      {cards.map((c, i) => (
        <MiniCard
          key={c.id}
          card={c}
          rank={c.pontuacao !== undefined ? i + 1 : undefined}
          best={best === i}
        />
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
  // The engine names the winner (same rule as the ranking). The delta is only
  // a fallback for payloads from before that key existed.
  const namedWinnerId = !Array.isArray(payload) ? payload.vencedor?.id : undefined;
  const winner =
    (namedWinnerId ? cards.find((c) => c.id === namedWinnerId) : undefined) ??
    (cards[1]?.valorEstimado?.valorLiquidoMensal !== undefined &&
    cards[0]?.valorEstimado?.valorLiquidoMensal !== undefined
      ? delta?.valorLiquidoMensal && delta.valorLiquidoMensal > 0
        ? cards[1]
        : cards[0]
      : null);

  // The net value is each column's lead number, so it is not repeated as a row.
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
      label: "Anuidade efetiva",
      key: (c) =>
        c.valorEstimado?.anuidadeEfetivaMensal !== undefined
          ? `-${moneyLabel(c.valorEstimado.anuidadeEfetivaMensal).replace("+", "")}`
          : feeLabel(c.anuidade),
      numericKey: (c) =>
        c.valorEstimado?.anuidadeEfetivaMensal !== undefined
          ? -c.valorEstimado.anuidadeEfetivaMensal
          : undefined,
    },
    {
      label: "Anuidade",
      key: (c) => feeLabel(c.anuidade),
      numericKey: (c) =>
        isFree(c.anuidade) ? 0 : typeof c.anuidade === "number" ? -c.anuidade : undefined,
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
    <div className="mt-2 space-y-3">
      {(delta || winner) && (
        <div className="rounded-panel bg-surface px-4 py-3">
          {winner && (
            <div className="flex flex-wrap items-center gap-2 py-1 text-sm">
              <span>
                Melhor no cálculo: <strong className="font-semibold text-fg">{winner.nome}</strong>
              </span>
              <Tag variant="brand">Melhor</Tag>
            </div>
          )}
          {delta && (
            <div>
              <DataRow
                label="Delta/mês"
                value={
                  <span className={signClass(delta.valorLiquidoMensal)}>
                    {moneyLabel(delta.valorLiquidoMensal ?? 0)}
                  </span>
                }
                detail={delta.origemRetorno}
              />
              <DataRow
                label="Delta/ano"
                value={
                  <span className={signClass(delta.valorLiquidoAnual)}>
                    {`R$ ${Math.round(delta.valorLiquidoAnual ?? 0).toLocaleString("pt-BR")}`}
                  </span>
                }
              />
              <DataRow
                label="Retorno"
                value={
                  <span className={signClass(delta.retornoBrutoMensal)}>
                    {moneyLabel(delta.retornoBrutoMensal ?? 0)}
                  </span>
                }
              />
              <DataRow
                label="Anuidade"
                value={
                  <span className={signClass(-(delta.anuidadeMensal ?? 0))}>
                    {moneyLabel(-(delta.anuidadeMensal ?? 0))}
                  </span>
                }
              />
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-panel border border-line bg-surface text-sm">
        <table className="w-full min-w-[440px] border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-2 align-top">
              <th className="px-3.5 py-3 text-left text-xs font-medium text-fg-3">Critério</th>
              {cards.map((c) => {
                const isWinner = winner?.id === c.id;
                const net = netMonthly(c);
                return (
                  <th key={c.id} className="px-3.5 py-3 text-left font-normal">
                    <Link href={`/cartoes/${c.id}`} className="group/cmp flex items-center gap-2.5">
                      <CardArt
                        artUrl={c.cardArtUrl}
                        issuerRaw={c.emissor ?? ""}
                        displayName={c.nome}
                        compact
                        className="h-8 w-12"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-tight text-fg group-hover/cmp:underline">
                          <span>{c.nome}</span>
                          {isWinner && <Tag variant="brand">Melhor</Tag>}
                        </span>
                        <span className="block text-xs text-fg-3">{c.emissor}</span>
                      </span>
                    </Link>
                    {net !== undefined ? (
                      <LeadFact
                        value={moneyLabel(net)}
                        label="Valor líquido"
                        marked={isWinner}
                        tone={signTone(net)}
                        size="sm"
                        className="mt-2"
                      />
                    ) : (
                      <LeadFact
                        value={feeLabel(c.anuidade)}
                        label="Anuidade"
                        size="sm"
                        className="mt-2"
                      />
                    )}
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
                  <td className="px-3.5 py-2.5 text-fg-2">{row.label}</td>
                  {cards.map((c, i) => (
                    <td key={c.id} className="ledger-col px-3.5 py-2.5 text-fg">
                      <span
                        className={cn(
                          best === i &&
                            "inline-flex rounded-full bg-success-tint px-2 py-0.5 font-semibold text-success-text"
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
  const net = c.valorEstimado ? (c.valorEstimado.valorLiquidoMensal ?? 0) : undefined;

  const stats: Stat[] = [];
  if (net !== undefined) {
    stats.push({
      label: "Anuidade",
      value: feeLabel(c.anuidade),
      tone: isFree(c.anuidade) ? "positive" : "default",
    });
  }
  if (c.valorEstimado) {
    stats.push({
      label: "Retorno bruto",
      value: moneyLabel(c.valorEstimado.retornoBrutoMensal ?? 0),
    });
  }
  stats.push({ label: "Lounge", value: hasLounge(c.lounge) ? "Sim" : "Não" });

  return (
    <div className="mt-2 rounded-panel bg-surface p-4">
      <div className="flex items-center gap-3">
        <CardArt
          artUrl={c.cardArtUrl}
          issuerRaw={c.emissor ?? ""}
          displayName={c.nome}
          compact
          className="h-10 w-16"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-fg">{c.nome}</p>
          <p className="truncate text-xs text-fg-3">{c.emissor}</p>
        </div>
      </div>

      {net !== undefined ? (
        <LeadFact
          value={moneyLabel(net)}
          label="Valor líquido"
          tone={net >= 0 ? "positive" : "negative"}
          className="mt-3"
        />
      ) : (
        <LeadFact
          value={feeLabel(c.anuidade)}
          label="Anuidade"
          tone={isFree(c.anuidade) ? "positive" : "default"}
          className="mt-3"
        />
      )}

      <StatRow stats={stats} className="mt-3" />

      {c.retornoFinanceiro?.earning_summary && (
        <p className="mt-2.5 text-xs leading-relaxed text-fg-2">
          {c.retornoFinanceiro.earning_summary}
        </p>
      )}

      <Link
        href={`/cartoes/${c.id}`}
        className="mt-3 inline-flex h-8 items-center rounded-full border border-line-strong bg-page px-3.5 text-xs font-medium text-fg transition-colors duration-100 hover:bg-surface-2"
      >
        Ver mais
      </Link>
    </div>
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

function WaiverMiniCard({ card, faltam }: { card: WaiverCardItem; faltam?: number }) {
  const visibleRules = (card.regrasIsencao ?? []).slice(0, 2);
  return (
    <Link
      href={`/cartoes/${card.id}`}
      className="group/waiver block rounded-panel bg-surface p-4 transition-colors duration-100 hover:bg-surface-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <CardArt
            artUrl={card.cardArtUrl}
            issuerRaw={card.emissor ?? ""}
            displayName={card.nome}
            compact
            className="h-10 w-16"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-snug text-fg">
              <span className="truncate group-hover/waiver:underline">{card.nome}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-fg-3" />
            </p>
            <p className="truncate text-xs text-fg-3">{card.emissor}</p>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <LeadFact value={feeLabel(card.anuidade)} label="Anuidade" size="sm" />
          {faltam !== undefined ? (
            <p className="num mt-1 text-xs text-fg-2">faltam R$ {faltam.toLocaleString("pt-BR")}</p>
          ) : (
            <Tag variant="positive" className="mt-1">
              Acessível agora
            </Tag>
          )}
        </div>
      </div>
      {visibleRules.length > 0 && (
        <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
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
                className="min-w-0 max-w-full shrink"
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="num truncate">{waiverRuleLabel(rule)}</span>
              </Tag>
            );
          })}
        </div>
      )}
    </Link>
  );
}

function InvestmentWaiverArtifact({ output }: { output: unknown }) {
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
      <div className="mt-2 space-y-2">
        {flat.map((c) => (
          <WaiverMiniCard key={c.id} card={c} />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {accessible.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Acessíveis agora <span className="num">({accessible.length})</span>
          </p>
          {accessible.map((c) => (
            <WaiverMiniCard key={c.id} card={c} />
          ))}
        </div>
      )}
      {needsMore.length > 0 &&
        (() => {
          const nearby = needsMore.filter((c) => (c.faltam ?? Infinity) <= 100_000);
          if (!nearby.length) return null;
          return (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Precisam de mais investimento <span className="num">({nearby.length})</span>
              </p>
              {nearby.map((c) => (
                <WaiverMiniCard key={c.id} card={c} faltam={c.faltam} />
              ))}
            </div>
          );
        })()}
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
}: {
  toolName: string;
  state: string;
  output?: unknown;
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
    return <CardListArtifact output={output} />;
  }
  if (toolName === "compareCards") {
    return <CardCompareArtifact output={output} />;
  }
  if (toolName === "getCardDetail") {
    return <CardDetailArtifact output={output} />;
  }
  if (toolName === "getInvestmentWaiverCards") {
    return <InvestmentWaiverArtifact output={output} />;
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
    <Conversation className="h-full overflow-y-auto px-4">
      <ConversationContent className="mx-auto max-w-2xl gap-5 px-0 py-5">
        {hiddenCount > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className={QUIET_BUTTON}>
            <ChevronUp className="h-3 w-3" />
            {hiddenCount} mensagen{hiddenCount !== 1 ? "s" : ""} anteriores
          </button>
        )}
        {(visibleMessages as UIMessage[]).map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}
        {isStreaming && (
          <div
            data-testid="chat-loading"
            role="status"
            aria-label="Carregando"
            className="flex items-center gap-2.5 py-1 text-xs text-fg-3"
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
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-page px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandMark className="h-4 w-5" />
                <p className="min-w-0 truncate text-sm font-semibold text-fg">
                  {selectedHistory ? selectedHistory.title : "Assistente de Cartões"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar conversa"
                onClick={() => {
                  setIsFullscreen(false);
                  setSelectedHistory(null);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-page text-fg-2 transition-colors duration-100 hover:bg-surface hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Conversation */}
            {selectedHistory ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4">
                <div className="mx-auto flex max-w-[768px] flex-col gap-6 py-6">
                  {selectedHistory.messages.map((msg) => (
                    <ChatMessageBubble key={msg.id} message={msg as UIMessage} />
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
