import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { createCardTools, SYSTEM_PROMPT } from "@/lib/ai-tools";
import type { UserProfile } from "@/types/cards";

export const runtime = "nodejs";

function profileContext(profile: UserProfile | null | undefined): string {
  if (!profile) return "";
  return `\n\nPerfil salvo do usuário para cálculos personalizados:\n- renda mensal: R$${profile.monthlySalaryBrl.toLocaleString("pt-BR")}\n- gasto mensal no cartão: R$${profile.avgMonthlySpendBrl.toLocaleString("pt-BR")}\n- investimentos: R$${profile.avgInvestedBrl.toLocaleString("pt-BR")}\n- gasto internacional mensal: R$${(profile.monthlyInternationalSpendBrl ?? 0).toLocaleString("pt-BR")}\n- viagens: ${profile.travelFrequency}\n- preferências: cashback=${profile.preferences.prefersCashback}, pontos=${profile.preferences.prefersPoints}, investback=${profile.preferences.prefersInvestback}, lounge=${profile.preferences.wantsLounge}\n- cartão atual: ${profile.currentPrimaryCardName ?? profile.currentPrimaryCardId ?? "não informado"}`;
}

export async function POST(req: Request) {
  const start = Date.now();
  console.log(JSON.stringify({ level: "info", route: "/api/chat", msg: "start" }));
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
