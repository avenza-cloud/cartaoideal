import { getCardById } from "@/lib/cards";
import { getAffiliateDestination } from "@/lib/affiliate";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const card = getCardById(cardId);
  if (!card) {
    return new Response("Unknown card", { status: 404 });
  }

  // O destino é resolvido no servidor a partir do catálogo — nunca do query param.
  const dest = getAffiliateDestination(card);
  if (!dest) {
    return new Response("No destination", { status: 404 });
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "affiliate_click",
      cardId,
      dest: new URL(dest).hostname,
      ts: new Date().toISOString(),
    })
  );

  return Response.redirect(dest, 302);
}
