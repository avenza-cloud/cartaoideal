"use client";

import { useMemo, useState } from "react";
import { DataRow, type Stat, StatRow, Tag } from "@/components/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TRAVEL_REDEMPTION_WEIGHT } from "@/lib/assumptions";
import {
  scoreCardValue,
  travelFrequencyForValueModeling,
  travelRedemptionWeight,
} from "@/lib/card-value";
import { formatGrossRewardMonthlyDisplay } from "@/lib/formatting";
import { useProfileStore } from "@/lib/store";
import { useValueAssumptions } from "@/lib/use-value-assumptions";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { CardFacet, CardValueAssumptions, CardValueComponent } from "@/types/cards";

function brl(value: number, maximumFractionDigits = 0) {
  const sign = value < 0 ? "-" : "";
  return `${sign}R$ ${Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits })}`;
}

function signedBrl(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$ ${Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function pct(value: number) {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function RetornoTooltip({
  component,
  monthlySpend,
  assumptions,
}: {
  component: CardValueComponent;
  monthlySpend: number;
  assumptions: CardValueAssumptions;
}) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
      <p className="font-medium text-popover-foreground">{component.label}</p>
      <p>{component.explanation}</p>
      <p className="num text-2xs">
        Gasto mensal: R${monthlySpend.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ·
        Livelo R${assumptions.liveloPointSaleValuePerThousandBrl}/1k venda · Livelo R$
        {assumptions.liveloPointTravelValuePerThousandBrl}/1k uso · MR R$
        {assumptions.membershipRewardsPointSaleValuePerThousandBrl}/1k venda · MR R$
        {assumptions.membershipRewardsPointTravelValuePerThousandBrl}/1k uso · PTAX R$
        {assumptions.ptaxBrlPerUsd}
      </p>
      {component.dataQualityNote && <p>{component.dataQualityNote}</p>}
    </div>
  );
}

export function CardProfileInsights({ card }: { card: CardFacet }) {
  const profile = useProfileStore((s) => s.profile);
  const assumptions = useValueAssumptions();
  const score = useMemo(
    () => (profile ? scoreCardValue(card, profile, "profile", assumptions) : null),
    [card, profile, assumptions]
  );
  const [showCalc, setShowCalc] = useState(false);

  if (!profile || !score) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Configure seu perfil para ver valor líquido e ponto de equilíbrio.
        </p>
        <Tag variant="quiet">Para você</Tag>
      </div>
    );
  }

  const decision = score.decisionMonthlyValueBrl;
  const low = Math.min(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
  const high = Math.max(score.netMonthlyValueBrl, score.netMonthlyValueRangeHighBrl);
  const hasRange = high - low >= 1;
  const travelFrequency = travelFrequencyForValueModeling(profile);
  const travelWeight = travelRedemptionWeight(profile);

  const reward = score.components.find((c) => c.key === "rewards");
  const intangibles = score.components.find((c) => c.key === "intangibles");
  const fee = score.components.find((c) => c.key === "fee");
  const international = score.components.find((c) => c.key === "international");

  const a = score.assumptions;

  const stats: Stat[] = [
    {
      label: "Retorno",
      value: formatGrossRewardMonthlyDisplay(score, travelFrequency),
      tone: score.grossRewardMonthlyRangeHighBrl > 0 ? "positive" : "default",
    },
    {
      label: "Benefícios",
      value: `${signedBrl(score.intangibleMonthlyValueBrl)}/mês`,
      tone: score.intangibleMonthlyValueBrl > 0 ? "positive" : "default",
    },
    score.feeKnown
      ? {
          label: "Anuidade",
          value: `${signedBrl(-score.effectiveMonthlyFeeBrl)}/mês`,
          tone: score.effectiveMonthlyFeeBrl > 0 ? "negative" : "default",
        }
      : { label: "Anuidade", value: "Não informada", tone: "muted" },
    {
      label: "Custo internacional",
      value: `${signedBrl(-score.internationalMonthlyCostBrl)}/mês`,
      tone: score.internationalMonthlyCostBrl > 0 ? "negative" : "default",
    },
  ];

  return (
    <section className="rounded-md border bg-card">
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Para você</h2>
          {!score.eligible && <Tag variant="negative">Não elegível</Tag>}
        </div>

        {/* The decision number: the loudest element on the page. */}
        <p className="num mt-3 whitespace-nowrap text-5xl font-medium tracking-tight">
          <span className={cn(decision < 0 && "text-negative")}>{brl(decision)}</span>
          <span className="text-xl text-muted-foreground">/mês</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          valor líquido estimado por mês
          {hasRange && (
            <span className="num">
              {" "}
              ({brl(low)} a {brl(high)})
            </span>
          )}
        </p>
        {!score.feeKnown && (
          <p className="mt-1 text-xs text-muted-foreground">
            Anuidade não informada: o valor acima não desconta anuidade.
          </p>
        )}

        <p className={cn("mt-4 text-base font-medium", !score.eligible && "text-negative")}>
          {score.verdict}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{score.rankReason}</p>
        {score.feeAppliedReason && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {score.feeAppliedReason}
          </p>
        )}

        <StatRow
          stats={stats}
          className="mt-4 bg-background max-sm:grid-cols-2! max-sm:[&>*:nth-child(-n+2)]:border-b max-sm:[&>*:nth-child(2)]:border-r-0"
        />

        <div className="mt-2">
          {reward && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
                >
                  Como o retorno foi estimado
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                sideOffset={6}
                className="block w-72 max-w-[calc(100vw-2rem)] border border-foreground bg-popover p-3 text-left text-popover-foreground [&_svg]:hidden"
              >
                <RetornoTooltip
                  component={reward}
                  monthlySpend={profile.avgMonthlySpendBrl}
                  assumptions={a}
                />
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="mt-2">
          <DataRow
            label="Equilíbrio"
            value={
              score.breakEvenMonthlySpendBrl === null
                ? "—"
                : `R$${score.breakEvenMonthlySpendBrl.toLocaleString("pt-BR")}/mês`
            }
          />
          {score.feeBurdenPctOfAnnualSpend !== null && score.feeBurdenPctOfAnnualSpend > 0 && (
            <DataRow
              label="Peso da anuidade"
              value={`anuidade ${score.feeBurdenPctOfAnnualSpend}% do gasto`}
            />
          )}
        </div>
      </div>

      {/* Collapsible method */}
      <div className="border-t">
        <button
          type="button"
          onClick={() => setShowCalc((v) => !v)}
          aria-expanded={showCalc}
          className="flex w-full items-center justify-between px-4 py-3 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <span>Como calculamos</span>
          <ChevronDown className={cn("h-3.5 w-3.5", showCalc && "rotate-180")} />
        </button>

        {showCalc && (
          <div className="space-y-5 border-t px-4 py-4">
            <MethodPart title="A conta">
              <p>
                Valor líquido por mês = retorno + benefícios − anuidade − custo internacional. Tudo
                em reais por mês, com o gasto e as respostas do seu perfil.
              </p>
              <div className="mt-2">
                {reward && <FormulaLine sign="+" component={reward} />}
                {intangibles && <FormulaLine sign="+" component={intangibles} />}
                {fee && <FormulaLine sign="−" component={fee} />}
                {international && <FormulaLine sign="−" component={international} />}
                <DataRow label="Soma, vendendo os pontos" value={`${brl(low)}/mês`} />
              </div>
            </MethodPart>

            <MethodPart title="O número em destaque">
              <p>
                Pontos e milhas valem mais usados em viagem do que vendidos. Por isso calculamos as
                duas pontas e mostramos o valor esperado entre elas: o valor vendendo os pontos mais{" "}
                <span className="num">{pct(travelWeight)}</span> da diferença até o valor usando os
                pontos em viagem. Esse peso vem da sua frequência de viagem:{" "}
                <span className="num">
                  {pct(TRAVEL_REDEMPTION_WEIGHT.none)} para quem não viaja,{" "}
                  {pct(TRAVEL_REDEMPTION_WEIGHT.occasional)} para quem viaja às vezes e{" "}
                  {pct(TRAVEL_REDEMPTION_WEIGHT.frequent)} para quem viaja com frequência
                </span>
                . Quem não viaja mas prefere pontos ou sala VIP é tratado como quem viaja às vezes.
              </p>
              <div className="mt-2">
                <DataRow label="Vendendo os pontos" value={`${brl(low)}/mês`} />
                <DataRow label="Usando em viagem" value={`${brl(high)}/mês`} />
                <DataRow label="Peso de viagem no seu perfil" value={pct(travelWeight)} />
                <DataRow label="Valor esperado" value={`${brl(decision)}/mês`} />
              </div>
              {!hasRange && (
                <p className="mt-2">
                  Neste cartão as duas pontas são iguais: o retorno não depende de como os pontos
                  são usados.
                </p>
              )}
            </MethodPart>

            <MethodPart title="Premissas usadas">
              <div>
                <DataRow label="Dólar (PTAX)" value={brl(a.ptaxBrlPerUsd, 4)} />
                <DataRow
                  label="Milhas aéreas, venda"
                  value={`${brl(a.mileValuePerThousandBrl)}/mil`}
                />
                <DataRow
                  label="Milhas aéreas, viagem"
                  value={`${brl(Math.max(a.mileValuePerThousandBrl, a.liveloPointTravelValuePerThousandBrl))}/mil`}
                />
                <DataRow
                  label="Livelo, venda"
                  value={`${brl(a.liveloPointSaleValuePerThousandBrl)}/mil`}
                />
                <DataRow
                  label="Livelo, viagem"
                  value={`${brl(a.liveloPointTravelValuePerThousandBrl)}/mil`}
                />
                <DataRow
                  label="Membership Rewards, venda"
                  value={`${brl(a.membershipRewardsPointSaleValuePerThousandBrl)}/mil`}
                />
                <DataRow
                  label="Membership Rewards, viagem"
                  value={`${brl(a.membershipRewardsPointTravelValuePerThousandBrl)}/mil`}
                />
                <DataRow
                  label="Outros pontos, venda"
                  value={`${brl(a.defaultPointValuePerThousandBrl)}/mil`}
                />
                <DataRow label="Visita a sala VIP" value={brl(a.loungeVisitValueBrl)} />
                <DataRow
                  label="Seguro viagem"
                  value={`${brl(a.travelInsuranceMonthlyValueBrl)}/mês`}
                />
                <DataRow label="Concierge" value={`${brl(a.conciergeMonthlyValueBrl)}/mês`} />
                <DataRow label="IOF em compra internacional" value={pct(a.iof)} />
              </div>
              <p className="mt-2">
                Valores por mil pontos ou milhas. São estimativas de mercado, não valores
                garantidos. Sala VIP, seguro e concierge só contam quando o cartão oferece o
                benefício e são ponderados pela sua frequência de viagem.
              </p>
            </MethodPart>

            <MethodPart title="A nota de 0 a 100">
              <p>
                A nota que aparece nos rankings é um percentil: a posição do cartão, pelo valor
                líquido estimado, entre os cartões para os quais o seu perfil é elegível. 100 é o
                melhor desse conjunto, 0 o pior. Ela não mede qualidade absoluta e muda quando o
                perfil muda.
              </p>
            </MethodPart>

            <MethodPart title="O que fica de fora">
              <p>
                A conta assume que a fatura é paga integralmente todo mês, sem juros. Com rotativo
                ou parcelamento da fatura, os juros superam qualquer retorno mostrado aqui.
              </p>
            </MethodPart>

            {score.dataQualityNotes.length > 0 && (
              <MethodPart title="Limites dos dados deste cartão">
                <ul className="space-y-1">
                  {score.dataQualityNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </MethodPart>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MethodPart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-xs leading-relaxed text-muted-foreground">
      <h3 className="mb-1 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function FormulaLine({ component, sign }: { component: CardValueComponent; sign: "+" | "−" }) {
  const amount = Math.abs(component.valueBrl).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  });
  return (
    <DataRow
      label={component.label}
      value={
        <span className={sign === "+" ? "text-positive" : "text-negative"}>
          {sign}R$ {amount}
        </span>
      }
      detail={component.explanation}
    />
  );
}
