"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DataRow, Tag } from "@/components/card";
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
    <div className="space-y-1.5 text-xs leading-relaxed text-fg-2">
      <p className="font-semibold text-fg">{component.label}</p>
      <p>{component.explanation}</p>
      <p className="num text-xs text-fg-3">
        Gasto mensal: R${monthlySpend.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ·
        Livelo R${assumptions.liveloPointSaleValuePerThousandBrl}/1k venda · Livelo R$
        {assumptions.liveloPointTravelValuePerThousandBrl}/1k uso · MR R$
        {assumptions.membershipRewardsPointSaleValuePerThousandBrl}/1k venda · MR R$
        {assumptions.membershipRewardsPointTravelValuePerThousandBrl}/1k uso · dólar comercial R$
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface px-5 py-4">
        <p className="text-sm text-fg-2">
          Configure seu perfil para calcular valor líquido mensal, isenção e ponto de equilíbrio.
        </p>
        <Link
          href="/perfil"
          className="text-sm font-semibold text-fg underline underline-offset-4 hover:text-brand-accent"
        >
          Configurar perfil
        </Link>
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

  return (
    <section className="rounded-panel bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-fg">Para você</h2>
            {score.eligible ? (
              <Tag variant="positive">Elegível</Tag>
            ) : (
              <Tag variant="negative">Não elegível</Tag>
            )}
          </div>

          {/* Single 36px display figure */}
          <p className="num mt-2.5 whitespace-nowrap text-5xl font-semibold tracking-tight">
            <span
              className={cn(
                decision > 0 ? "text-success-text" : decision < 0 ? "text-danger-text" : "text-fg"
              )}
            >
              {decision > 0 ? `+${brl(decision)}` : brl(decision)}
            </span>
            <span className="text-lg font-medium text-fg-3">/mês</span>
          </p>
          <p className="mt-1 text-xs text-fg-3">
            Valor líquido estimado por mês
            {hasRange && (
              <span className="num">
                {" "}
                ({brl(low)} a {brl(high)})
              </span>
            )}
          </p>
          {!score.feeKnown && (
            <p className="mt-1 text-xs text-warn-text">
              Anuidade não informada: o valor acima não desconta anuidade.
            </p>
          )}
        </div>
        <Tag variant="quiet" className="num h-7 px-3 text-xs">
          Nota {score.score0To100}/100
        </Tag>
      </div>

      <p
        className={cn(
          "mt-4 max-w-[62ch] text-[15px] font-medium leading-relaxed",
          !score.eligible ? "text-danger-text" : "text-fg"
        )}
      >
        {score.verdict}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-fg-2">{score.rankReason}</p>
      {score.feeAppliedReason && (
        <p className="mt-1 text-sm leading-relaxed text-fg-2">{score.feeAppliedReason}</p>
      )}

      {/* Clean hairline ledger breakdown (no nested equal stat boxes) */}
      <div className="mt-5 border-t border-line">
        <DataRow
          label="Retorno bruto estimado"
          value={
            <span
              className={score.grossRewardMonthlyRangeHighBrl > 0 ? "text-success-text" : undefined}
            >
              {formatGrossRewardMonthlyDisplay(score, travelFrequency)}
            </span>
          }
        />
        <DataRow
          label="Benefícios estimados"
          value={
            <span className={score.intangibleMonthlyValueBrl > 0 ? "text-success-text" : undefined}>
              {`${signedBrl(score.intangibleMonthlyValueBrl)}/mês`}
            </span>
          }
        />
        <DataRow
          label="Anuidade efetiva"
          value={
            score.feeKnown ? (
              <span
                className={
                  score.effectiveMonthlyFeeBrl > 0 ? "text-danger-text" : "text-success-text"
                }
              >
                {score.effectiveMonthlyFeeBrl > 0
                  ? `${signedBrl(-score.effectiveMonthlyFeeBrl)}/mês`
                  : "R$ 0/mês (isento)"}
              </span>
            ) : (
              <span className="text-fg-3">Não informada</span>
            )
          }
        />
        {score.internationalMonthlyCostBrl > 0 && (
          <DataRow
            label="Custo internacional"
            value={
              <span className="text-danger-text">
                {`${signedBrl(-score.internationalMonthlyCostBrl)}/mês`}
              </span>
            }
          />
        )}
        <DataRow
          label="Ponto de equilíbrio"
          value={
            score.breakEvenMonthlySpendBrl === null
              ? "—"
              : `R$ ${score.breakEvenMonthlySpendBrl.toLocaleString("pt-BR")}/mês`
          }
        />
        {score.feeBurdenPctOfAnnualSpend !== null && score.feeBurdenPctOfAnnualSpend > 0 && (
          <DataRow
            label="Peso da anuidade"
            value={`${score.feeBurdenPctOfAnnualSpend}% do gasto anual`}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        {reward ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-xs font-medium text-fg-2 underline underline-offset-4 transition-colors duration-100 hover:text-fg"
              >
                Como o retorno foi estimado
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              sideOffset={6}
              className="block w-80 max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-raised p-3.5 text-left text-fg shadow-menu"
            >
              <RetornoTooltip
                component={reward}
                monthlySpend={profile.avgMonthlySpendBrl}
                assumptions={a}
              />
            </TooltipContent>
          </Tooltip>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => setShowCalc((v) => !v)}
          aria-expanded={showCalc}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-fg-2 transition-colors duration-100 hover:bg-surface-2 hover:text-fg"
        >
          <span>Como calculamos</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-150",
              showCalc && "rotate-180"
            )}
          />
        </button>
      </div>

      {showCalc && (
        <div className="mt-4 space-y-6 border-t border-line pt-5">
          <MethodPart title="A conta">
            <p>
              Valor líquido por mês = retorno + benefícios − anuidade − custo internacional. Tudo em
              reais por mês, com o gasto e as respostas do seu perfil.
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
                Neste cartão as duas pontas são iguais: o retorno não depende de como os pontos são
                usados.
              </p>
            )}
          </MethodPart>

          <MethodPart title="Premissas usadas">
            <div>
              <DataRow label="Dólar comercial" value={brl(a.ptaxBrlPerUsd, 4)} />
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
              Valores por mil pontos ou milhas. São estimativas de mercado, não valores garantidos.
              Sala VIP, seguro e concierge só contam quando o cartão oferece o benefício e são
              ponderados pela sua frequência de viagem.
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
              A conta assume que a fatura é paga integralmente todo mês, sem juros. Com rotativo ou
              parcelamento da fatura, os juros superam qualquer retorno mostrado aqui.
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
    </section>
  );
}

function MethodPart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-sm leading-relaxed text-fg-2">
      <h3 className="mb-1.5 text-sm font-semibold text-fg">{title}</h3>
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
        <span className={sign === "+" ? "text-success-text" : "text-danger-text"}>
          {sign}R$ {amount}
        </span>
      }
      detail={component.explanation}
    />
  );
}
