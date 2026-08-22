import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { chatModel } from "@/lib/ai-model";
import { z } from "zod";
import { createCardTools, SYSTEM_PROMPT, toToolProfile } from "@/lib/ai-tools";
import { profileSchema } from "@/lib/profile-schema";
import { apiError } from "@/lib/api-error";
import { createRateLimiter, tooManyRequests } from "@/lib/rate-limit";
import { logEvent } from "@/lib/log";
import type { UserProfile } from "@/types/cards";

export const runtime = "nodejs";

// Strictest limit of the API: unauthenticated endpoint calling a paid LLM.
const limiter = createRateLimiter({ windowMs: 60_000, max: 10, keyPrefix: "chat" });

const bodySchema = z.object({
  // UIMessage shapes come from the AI SDK; cap count and validate loosely.
  messages: z.array(z.record(z.string(), z.unknown())).min(1).max(60),
  profile: profileSchema.nullish(),
});

function profileContext(profile: UserProfile | null | undefined): string {
  if (!profile) return "";
  const t = toToolProfile(profile);
  const brl = (v: number) => v.toLocaleString("pt-BR");
  return `\n\nPerfil salvo do usuário para cálculos personalizados:\n- renda mensal: R$${brl(t.monthlySalaryBrl)}\n- gasto mensal no cartão: R$${brl(t.avgMonthlySpendBrl)}\n- investimentos: R$${brl(t.avgInvestedBrl)}\n- gasto internacional mensal: R$${brl(t.monthlyInternationalSpendBrl)}\n- viagens: ${t.travelFrequency}\n- preferências: cashback=${t.prefersCashback}, pontos=${t.prefersPoints}, lounge=${t.wantsLounge}\n- cartão atual: ${profile.currentPrimaryCardName ?? profile.currentPrimaryCardId ?? "não informado"}`;
}

export async function POST(req: Request) {
  const decision = await limiter.check(req);
  if (!decision.allowed) return tooManyRequests(decision, limiter.limit);

  const start = Date.now();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Corpo da requisição inválido.");
  const { messages, profile } = parsed.data;

  const result = streamText({
    model: chatModel,
    system: `${SYSTEM_PROMPT}${profileContext(profile as UserProfile | null)}`,
    messages: await convertToModelMessages(
      messages as Parameters<typeof convertToModelMessages>[0]
    ),
    tools: createCardTools(profile as UserProfile | null),
    stopWhen: stepCountIs(5),
    onStepFinish({ toolCalls }) {
      for (const tc of toolCalls ?? []) {
        // Tool inputs derive from the user's financial profile — log names only.
        logEvent("/api/chat", { tool: tc.toolName });
      }
    },
    onFinish({ usage }) {
      logEvent("/api/chat", { tokens: usage?.totalTokens ?? null, ms: Date.now() - start });
    },
  });

  return result.toUIMessageStreamResponse();
}
