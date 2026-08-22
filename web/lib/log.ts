/**
 * Structured one-line JSON logging for API routes.
 *
 * Redaction policy (LGPD): NEVER log request IPs, chat message content,
 * profile financials (salary, spend, investments), tool-call inputs, or
 * contact info. Log route names, counts, durations, hostnames and error
 * classes — enough to operate, nothing that identifies a person.
 */
export function logEvent(
  route: string,
  fields: Record<string, string | number | boolean | null | undefined>
): void {
  console.log(JSON.stringify({ level: "info", route, ...fields }));
}
