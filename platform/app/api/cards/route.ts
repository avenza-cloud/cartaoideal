import { filterCards } from "@/lib/cards";
import type { CardFilters, MarketSegment } from "@/types/cards";

export async function GET(req: Request) {
  const start = Date.now();
  const { searchParams } = new URL(req.url);

  const filters: CardFilters = {};

  const segment = searchParams.get("segment");
  if (segment) filters.segment = segment as MarketSegment;

  const network = searchParams.get("network");
  if (network) filters.network = network;

  if (searchParams.get("lounge") === "true") filters.lounge = true;
  if (
    searchParams.get("rewardReturn") === "true" ||
    searchParams.get("cashback") === "true" ||
    searchParams.get("investback") === "true"
  ) {
    filters.rewardReturn = true;
  }
  if (searchParams.get("points") === "true") filters.points = true;
  if (searchParams.get("zeroFee") === "true") filters.zeroFee = true;

  const maxFee = searchParams.get("maxFee");
  if (maxFee) filters.maxFee = Number(maxFee);

  const search = searchParams.get("search");
  if (search) filters.search = search;

  const results = filterCards(filters);
  console.log(
    JSON.stringify({ level: "info", route: "/api/cards", count: results.length, ms: Date.now() - start })
  );
  return Response.json(results);
}
