import { z } from "zod";
import { getAllCards } from "@/lib/cards";
import { scoreCards } from "@/lib/scoring";
import { getValueAssumptionsWithLiveUsd } from "@/lib/exchange-rate";
import type { UserProfile } from "@/types/cards";

export const runtime = "nodejs";

const preferencesSchema = z.object({
  wantsLounge: z.boolean().default(false),
  prefersCashback: z.boolean().default(false),
  prefersPoints: z.boolean().default(false),
  prefersInvestback: z.boolean().default(false),
});

const profileSchema = z.object({
  monthlySalaryBrl: z.number().nonnegative(),
  avgMonthlySpendBrl: z.number().nonnegative(),
  avgInvestedBrl: z.number().nonnegative().default(0),
  monthlyInternationalSpendBrl: z.number().nonnegative().optional(),
  currentPrimaryCardId: z.string().optional(),
  currentPrimaryCardName: z.string().optional(),
  travelFrequency: z.enum(["none", "occasional", "frequent"]).default("none"),
  spendingCategories: z
    .array(z.enum(["supermercado", "combustivel", "restaurantes", "viagens", "streaming"]))
    .default([]),
  preferences: preferencesSchema,
});

export async function POST(req: Request) {
  const start = Date.now();

  let profile: UserProfile;
  try {
    const body = await req.json();
    const parsed = profileSchema.safeParse(body?.profile);
    if (!parsed.success) {
      return Response.json({ error: "Perfil inválido" }, { status: 400 });
    }
    profile = parsed.data as UserProfile;
  } catch {
    return Response.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const cards = getAllCards();
  const assumptions = await getValueAssumptionsWithLiveUsd();
  const scored = scoreCards(cards, profile, assumptions).slice(0, 10);

  console.log(
    JSON.stringify({ level: "info", route: "/api/recommend", count: scored.length, ms: Date.now() - start })
  );

  return Response.json(scored);
}
