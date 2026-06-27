import { cookies } from "next/headers";
import { getMarketBriefing } from "@/lib/server/marketData";
import { sanitizeUser } from "@/lib/server/utils";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = sanitizeUser(searchParams.get("user"));

    const cookieStore = await cookies();
    const token = cookieStore.get("stocksense_token")?.value;

    let watchlist = [];
    try {
      const headers = { "content-type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const profileRes = await fetch(`${BACKEND}/user/profile`, { headers });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData && profileData.ok && profileData.user) {
          watchlist = profileData.user.watchlists || [];
        }
      }
    } catch (profileErr) {
      console.error("Failed to fetch watchlist for briefing:", profileErr);
    }

    const data = await getMarketBriefing(user, watchlist);

    return Response.json(
      { ok: true, data },
      {
        headers: {
          "cache-control": "public, max-age=30, stale-while-revalidate=120",
        },
      }
    );
  } catch {
    return Response.json(
      { ok: false, error: "Unable to generate market briefing" },
      { status: 500 }
    );
  }
}

