import { z } from "zod";
import { getCardById } from "@/lib/cards";
import { CORRECTION_FIELDS } from "@/lib/correction-fields";
import { apiError } from "@/lib/api-error";
import { createRateLimiter, tooManyRequests } from "@/lib/rate-limit";
import { logEvent } from "@/lib/log";

export const runtime = "nodejs";

const limiter = createRateLimiter({ windowMs: 60_000, max: 3, keyPrefix: "corrections" });

// No contact field: the issue body is public on GitHub, so we never publish
// submitter-identifying data. Contributors can comment on the issue afterwards.
const correctionSchema = z.object({
  cardId: z.string().min(1).max(200),
  cardName: z.string().min(1).max(200),
  issuer: z.string().max(200).optional().default(""),
  field: z.enum(CORRECTION_FIELDS),
  suggestedValue: z.string().min(1).max(2000),
  sourceUrl: z.string().url().max(2000),
  notes: z.string().max(2000).optional().default(""),
  pageSourceUrl: z.string().url().max(2000).optional(),
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
  const decision = await limiter.check(req);
  if (!decision.allowed) return tooManyRequests(decision, limiter.limit);

  const parsed = correctionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Dados inválidos para correção.");
  if (!getCardById(parsed.data.cardId)) {
    return apiError("invalid_input", "Cartão não encontrado no catálogo.");
  }

  const token = process.env.GITHUB_CORRECTIONS_TOKEN;
  const repo = process.env.GITHUB_CORRECTIONS_REPO;
  if (!token || !repo) {
    // Fail closed: forks without the env vars must not file issues anywhere.
    return apiError("not_configured", "Automação de correções não configurada no servidor.");
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    return apiError("not_configured", "Repositório de correções inválido.");
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
    // Repo without the labels — retry unlabeled rather than dropping the report.
    response = await createIssue({ title: issuePayload.title, body: issuePayload.body });
  }

  const issue = await response.json().catch(() => null);
  if (!response.ok) {
    return apiError("upstream_error", issue?.message ?? "Falha ao criar issue no GitHub.");
  }

  logEvent("/api/corrections", { issueNumber: issue.number });
  return Response.json({ issueUrl: issue.html_url, issueNumber: issue.number });
}
