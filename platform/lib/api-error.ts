/**
 * Error taxonomy shared by the API routes:
 * 400 invalid input (client bug — do not retry unchanged)
 * 429 rate limited (see lib/rate-limit.ts for headers)
 * 502 upstream dependency failed (retryable)
 * 503 feature not configured in this deployment
 * 500 unexpected
 */
export type ApiErrorCode =
  | "invalid_input"
  | "rate_limited"
  | "upstream_error"
  | "not_configured"
  | "internal_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  rate_limited: 429,
  upstream_error: 502,
  not_configured: 503,
  internal_error: 500,
};

export function apiError(code: ApiErrorCode, messagePtBr: string, init?: ResponseInit): Response {
  return Response.json({ error: messagePtBr, code }, { status: STATUS_BY_CODE[code], ...init });
}
