import { getCardsByIds } from "@/lib/cards";

export async function POST(req: Request) {
  const start = Date.now();
  const { cardIds } = await req.json();

  if (!Array.isArray(cardIds) || cardIds.length < 2) {
    return Response.json({ error: "Mínimo 2 cartões" }, { status: 400 });
  }

  const cards = getCardsByIds(cardIds.slice(0, 4));
  console.log(
    JSON.stringify({ level: "info", route: "/api/compare", count: cards.length, ms: Date.now() - start })
  );
  return Response.json(cards);
}
