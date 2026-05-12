"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScoreBreakdownBar } from "@/components/ScoreBreakdown";
import { formatFee, segmentLabel } from "@/lib/formatting";
import { CLIENT_CARD_OPTIONS } from "@/lib/client-card-options";
import { formatBrlInput, formatBrlNumber, parseBrlInput } from "@/lib/brl";
import { fetchRecommendationsWithFallback } from "@/lib/recommend-fallback";
import { travelFrequencyForValueModeling } from "@/lib/card-value";
import { useCardDetailHrefBuilder } from "@/lib/use-card-detail-href";
import Link from "next/link";
import type { CardScore, SpendingCategory, TravelFrequency, UserProfile } from "@/types/cards";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const SPENDING_CATEGORIES: { value: SpendingCategory; label: string }[] = [
  { value: "supermercado", label: "Supermercado" },
  { value: "combustivel", label: "Combustível" },
  { value: "restaurantes", label: "Restaurantes" },
  { value: "viagens", label: "Viagens" },
  { value: "streaming", label: "Streaming" },
];

const TRAVEL_OPTIONS: { value: TravelFrequency; label: string; desc: string }[] = [
  { value: "none", label: "Não viajo", desc: "0 a 3 viagens por ano" },
  { value: "occasional", label: "Às vezes", desc: "4 a 8 viagens por ano" },
  { value: "frequent", label: "Frequente", desc: "8+ viagens por ano" },
];

const INITIAL_PROFILE: UserProfile = {
  monthlySalaryBrl: 0,
  avgMonthlySpendBrl: 0,
  avgInvestedBrl: 0,
  currentPrimaryCardName: "",
  currentPrimaryCardId: undefined,
  travelFrequency: "none",
  spendingCategories: [],
  preferences: {
    wantsLounge: false,
    prefersCashback: false,
    prefersPoints: false,
    prefersInvestback: false,
  },
};

export function FitQuiz() {
  const [step, setStep] = useState<Step>(1);
  const cardDetailHref = useCardDetailHrefBuilder();
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [salaryInput, setSalaryInput] = useState("");
  const [spendInput, setSpendInput] = useState("");
  const [investedInput, setInvestedInput] = useState("");
  const [results, setResults] = useState<CardScore[] | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleCategory(cat: SpendingCategory) {
    setProfile((p) => ({
      ...p,
      spendingCategories: p.spendingCategories.includes(cat)
        ? p.spendingCategories.filter((c) => c !== cat)
        : [...p.spendingCategories, cat],
    }));
  }

  function togglePref(key: keyof UserProfile["preferences"]) {
    setProfile((p) => ({
      ...p,
      preferences: { ...p.preferences, [key]: !p.preferences[key] },
    }));
  }

  async function submit() {
    setLoading(true);
    try {
      const data = await fetchRecommendationsWithFallback(profile);
      setResults(data);
      setStep(4);
    } catch {
      // silently fall through — user can retry
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl space-y-6">
      {/* Progress */}
      {step < 4 && (
        <div className="flex gap-1.5">
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Renda e gastos mensais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="salary">Renda mensal bruta (R$)</Label>
              <Input
                id="salary"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 5.000"
                value={salaryInput || formatBrlNumber(profile.monthlySalaryBrl)}
                onChange={(e) => {
                  const formatted = formatBrlInput(e.target.value);
                  setSalaryInput(formatted);
                  setProfile((p) => ({ ...p, monthlySalaryBrl: parseBrlInput(formatted) }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spend">Gasto médio mensal no cartão (R$)</Label>
              <Input
                id="spend"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 2.000"
                value={spendInput || formatBrlNumber(profile.avgMonthlySpendBrl)}
                onChange={(e) => {
                  const formatted = formatBrlInput(e.target.value);
                  setSpendInput(formatted);
                  setProfile((p) => ({ ...p, avgMonthlySpendBrl: parseBrlInput(formatted) }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invest">Patrimônio investido (R$)</Label>
              <Input
                id="invest"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 50.000"
                value={investedInput || formatBrlNumber(profile.avgInvestedBrl)}
                onChange={(e) => {
                  const formatted = formatBrlInput(e.target.value);
                  setInvestedInput(formatted);
                  setProfile((p) => ({ ...p, avgInvestedBrl: parseBrlInput(formatted) }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Usado para cartões de investimento como XP e Rico.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="current-card">Cartão principal atual</Label>
              <Input
                id="current-card"
                list="current-card-options"
                placeholder="Ex: Nubank Ultravioleta"
                value={profile.currentPrimaryCardName ?? ""}
                onChange={(e) => {
                  const name = e.target.value;
                  const match = CLIENT_CARD_OPTIONS.find((card) => card.name === name);
                  setProfile((p) => ({
                    ...p,
                    currentPrimaryCardName: name || undefined,
                    currentPrimaryCardId: match?.id,
                  }));
                }}
              />
              <datalist id="current-card-options">
                {CLIENT_CARD_OPTIONS.map((card) => (
                  <option key={card.id} value={card.name} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Usado para comparar troca real contra a recomendação.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={!profile.monthlySalaryBrl}
              onClick={() => setStep(2)}
            >
              Próximo <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onde você mais gasta?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SPENDING_CATEGORIES.map((cat) => (
                <Badge
                  key={cat.value}
                  variant={
                    profile.spendingCategories.includes(cat.value) ? "default" : "outline"
                  }
                  className="cursor-pointer text-sm py-1.5 px-3"
                  onClick={() => toggleCategory(cat.value)}
                >
                  {cat.label}
                </Badge>
              ))}
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Com que frequência você viaja?</p>
              {TRAVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setProfile((p) => ({ ...p, travelFrequency: opt.value }))
                  }
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    profile.travelFrequency === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border/80 hover:bg-muted/50"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{opt.desc}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Voltar
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quais benefícios você prioriza?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "prefersCashback" as const, label: "Retorno financeiro", desc: "Cashback ou crédito na fatura" },
              { key: "prefersPoints" as const, label: "Pontos e milhas", desc: "Acumular para resgatar em viagens" },
              { key: "wantsLounge" as const, label: "Acesso a lounge", desc: "Salas VIP em aeroportos" },
            ].map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => togglePref(key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  profile.preferences[key]
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-border/80 hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground ml-2 text-xs">{desc}</span>
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Voltar
              </Button>
              <Button className="flex-1" onClick={submit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  "Ver meus cartões"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {results.length > 0
                ? `${results.length} cartões recomendados`
                : "Nenhum cartão encontrado"}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStep(1); setResults(null); setProfile(INITIAL_PROFILE); }}
            >
              Recomeçar
            </Button>
          </div>

          {results.map((item) => (
            <Card key={item.card.card_stable_id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{item.card.issuer_raw}</p>
                    <CardTitle className="text-sm mt-0.5">{item.card.display_name}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {segmentLabel(item.card.market_segment_guess)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatFee(item.card.facets_numeric_or_special.annual_fee_brl_best_estimate)}
                  {typeof item.card.facets_numeric_or_special.annual_fee_brl_best_estimate === "number" &&
                    item.card.facets_numeric_or_special.annual_fee_brl_best_estimate > 0 &&
                    "/ano"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScoreBreakdownBar
                  breakdown={item.breakdown}
                  totalScore={item.totalScore}
                  valueScore={item.valueScore}
                  travelFrequency={travelFrequencyForValueModeling(profile)}
                />
                <Link
                  href={cardDetailHref(item.card.card_stable_id)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Ver detalhes
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
