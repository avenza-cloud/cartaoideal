import { getUsdBrlExchangeRate } from "@/lib/exchange-rate";

export async function GET() {
  const rate = await getUsdBrlExchangeRate();
  return Response.json(rate);
}
