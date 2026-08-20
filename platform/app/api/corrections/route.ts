import { z } from "zod";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;

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

const correctionSchema = z.object({
  cardId: z.string().min(1),
  cardName: z.string().min(1),
  issuer: z.string().optional().default(""),
  field: z.string().min(1),
  suggestedValue: z.string().min(1),
  sourceUrl: z.string().url(),
  notes: z.string().optional().default(""),
  contact: z.string().optional().default(""),
  pageSourceUrl: z.string().url().optional(),
});

function issueBody(payload: z.infer<typeof correctionSchema>) {
  const correction = {
    ...payload,
    submittedAt: new Date().toISOString(),
    status: "pending_review",
  };

  return [
    "Correção enviada pela comunidade.",
    "",
    "```json card-correction",
    JSON.stringify(correction, null, 2),
    "```",
    "",
    "Checklist:",
    "- [ ] Conferir a fonte",
    "- [ ] Atualizar o catálogo canônico se fizer sentido",
    "- [ ] Rodar validações/testes relevantes",
  ].join("\n");
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

  const parsed = correctionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos para correção." }, { status: 400 });
  }

  const token = process.env.GITHUB_CORRECTIONS_TOKEN;
  const repo = process.env.GITHUB_CORRECTIONS_REPO ?? "caiotheodoro/cartaoideal";
  if (!token) {
    return Response.json(
      { error: "Automação de correções não configurada no servidor." },
      { status: 503 }
    );
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    return Response.json({ error: "Repositório de correções inválido." }, { status: 500 });
  }

  const issuePayload = {
      title: `Correção: ${parsed.data.cardName} — ${parsed.data.field}`,
      body: issueBody(parsed.data),
      labels: ["correction", "needs-review"],
  };

  const createIssue = (body: typeof issuePayload | Omit<typeof issuePayload, "labels">) =>
    fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });

  let response = await createIssue(issuePayload);
  if (!response.ok && response.status === 422) {
    response = await createIssue({
      title: issuePayload.title,
      body: issuePayload.body,
    });
  }

  const issue = await response.json().catch(() => null);
  if (!response.ok) {
    return Response.json(
      { error: issue?.message ?? "Falha ao criar issue no GitHub." },
      { status: 502 }
    );
  }

  return Response.json({ issueUrl: issue.html_url, issueNumber: issue.number });
}
