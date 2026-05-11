export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const { searchParams } = new URL(req.url);
  const dest = searchParams.get("dest");

  if (!dest) {
    return new Response("Missing dest", { status: 400 });
  }

  // Basic validation — only allow http/https destinations
  let destUrl: URL;
  try {
    destUrl = new URL(dest);
    if (destUrl.protocol !== "https:" && destUrl.protocol !== "http:") {
      return new Response("Invalid destination", { status: 400 });
    }
  } catch {
    return new Response("Invalid destination", { status: 400 });
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "affiliate_click",
      cardId,
      dest: destUrl.hostname,
      ts: new Date().toISOString(),
    })
  );

  return Response.redirect(destUrl.toString(), 302);
}
