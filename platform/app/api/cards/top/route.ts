import { getAllCards } from "@/lib/cards";
import { scoreCardValues, DEFAULT_SCORING_PROFILE } from "@/lib/card-value";
import { getValueAssumptionsWithLiveUsd } from "@/lib/exchange-rate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "10", 10), 30);

  const assumptions = await getValueAssumptionsWithLiveUsd();
  const cards = scoreCardValues(getAllCards(), DEFAULT_SCORING_PROFILE, "default", assumptions)
    .slice(0, limit);

  return Response.json(
    cards.map((score) => {
      const c = score.card;
      const { text_for_embedding_compare: _text, labels_for_filtering: _labels, ...card } = c;
      return {
      id: c.card_stable_id,
      nome: c.display_name,
      emissor: c.issuer_raw,
      bandeira: c.network_primary,
      segmento: c.market_segment_guess,
      anuidade: c.facets_numeric_or_special.annual_fee_brl_best_estimate,
      rankingPosition: c.ranking_position,
      rankingScore: c.ranking_score,
      score: { ...score, card, assumptions: undefined },
      lounge: c.lounge_access,
      retornoFinanceiro: c.reward_return,
      pontos: c.facets_boolean.earn_points_or_miles,
      cardArtUrl: c.media.card_art_url,
      altText: c.media.alt_text,
      };
    })
  );
}
