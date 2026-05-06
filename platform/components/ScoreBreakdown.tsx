"use client";

import type { CardValueScore, ScoreBreakdown } from "@/types/cards";

interface Props {
  breakdown: ScoreBreakdown;
  totalScore: number;
  valueScore?: CardValueScore;
}

function formatMoney(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$${Math.abs(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}`;
}

export function ScoreBreakdownBar({ breakdown, totalScore, valueScore }: Props) {
  if (valueScore) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Valor líquido estimado
          </span>
          <span
            className={`text-lg font-bold font-mono ${
              valueScore.netMonthlyValueBrl >= 0 ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {formatMoney(valueScore.netMonthlyValueBrl)}/mês
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">{valueScore.verdict}</p>
        <div className="divide-y rounded-xl border">
          {valueScore.components.map((component) => (
            <div key={component.key} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium">{component.label}</p>
                <p className="text-[10px] text-muted-foreground">{component.explanation}</p>
              </div>
              <span
                className={`shrink-0 font-mono text-xs ${
                  component.valueBrl >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {formatMoney(component.valueBrl)}
              </span>
            </div>
          ))}
        </div>
        {valueScore.dataQualityNotes.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {valueScore.dataQualityNotes.slice(0, 2).join(" ")}
          </p>
        )}
      </div>
    );
  }

  const dims = [
    { value: breakdown.feeAffordability, label: "Custo-benefício da anuidade" },
    { value: breakdown.rewardsMatch, label: "Compatibilidade de recompensas" },
    { value: breakdown.travelBenefits, label: "Benefícios de viagem" },
    { value: breakdown.segmentFit, label: "Adequação ao perfil" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Pontuação total</span>
        <span className="text-lg font-bold font-mono">{Math.round(totalScore * 100)}%</span>
      </div>
      {dims.map(({ value, label }) => {
        const pct = Math.round(value * 100);
        return (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono text-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
