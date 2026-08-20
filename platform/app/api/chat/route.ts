import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { createCardTools, SYSTEM_PROMPT, toToolProfile } from "@/lib/ai-tools";
import type { UserProfile } from "@/types/cards";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

function profileContext(profile: UserProfile | null | undefined): string {
  if (!profile) return "";
  const t = toToolProfile(profile);
  const brl = (v: number) => v.toLocaleString("pt-BR");
  return `\n\nPerfil salvo do usuário para cálculos personalizados:\n- renda mensal: R$${brl(t.monthlySalaryBrl)}\n- gasto mensal no cartão: R$${brl(t.avgMonthlySpendBrl)}\n- investimentos: R$${brl(t.avgInvestedBrl)}\n- gasto internacional mensal: R$${brl(t.monthlyInternationalSpendBrl)}\n- viagens: ${t.travelFrequency}\n- preferências: cashback=${t.prefersCashback}, pontos=${t.prefersPoints}, lounge=${t.wantsLounge}\n- cartão atual: ${profile.currentPrimaryCardName ?? profile.currentPrimaryCardId ?? "não informado"}`;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
        "X-RateLimit-Window": "60",
      },
    });
  }

  const start = Date.now();
  console.log(JSON.stringify({ level: "info", route: "/api/chat", msg: "start", ip }));
  const { messages, profile } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-nano"),
    system: `${SYSTEM_PROMPT}${profileContext(profile)}`,
    messages: await convertToModelMessages(messages),
    tools: createCardTools(profile),
    stopWhen: stepCountIs(5),
    onStepFinish({ toolCalls }) {
      for (const tc of toolCalls ?? []) {
        console.log(JSON.stringify({ level: "info", route: "/api/chat", tool: tc.toolName, args: "input" in tc ? tc.input : undefined }));
      }
    },
    onFinish({ usage }) {
      console.log(
        JSON.stringify({
          level: "info",
          route: "/api/chat",
          tokens: usage?.totalTokens,
          ms: Date.now() - start,
        })
      );
    },
  });

  return result.toUIMessageStreamResponse();
}
