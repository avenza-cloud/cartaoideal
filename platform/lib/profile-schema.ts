import { z } from "zod";

/** User-profile contract shared by /api/recommend and /api/chat. */
export const preferencesSchema = z.object({
  wantsLounge: z.boolean().default(false),
  prefersCashback: z.boolean().default(false),
  prefersPoints: z.boolean().default(false),
  prefersInvestback: z.boolean().default(false),
});

export const profileSchema = z.object({
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
