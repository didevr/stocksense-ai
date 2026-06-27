import { getNewsDashboard } from "@/lib/server/marketData";

function sanitizeSymbols(raw) {
  const fallback = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"];
  if (!raw) return fallback;

  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9.-]{2,15}$/.test(s));

  return symbols.length ? symbols.slice(0, 8) : fallback;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = sanitizeSymbols(searchParams.get("symbols"));
    const data = await getNewsDashboard(symbols);

    return Response.json(
      { ok: true, data },
      {
        headers: {
          "cache-control": "public, max-age=45, stale-while-revalidate=120",
        },
      }
    );
  } catch {
    return Response.json(
      { ok: false, error: "Unable to load news dashboard" },
      { status: 500 }
    );
  }
}

