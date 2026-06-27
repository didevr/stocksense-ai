import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("stocksense_token")?.value;

  if (!token) {
    return Response.json({ ok: false, detail: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      cookieStore.delete("stocksense_token");
      return Response.json({ ok: false, detail: "Session expired or invalid token." }, { status: 401 });
    }

    const metadata = user.user_metadata || {};

    return Response.json(
      {
        ok: true,
        user: {
          name: metadata.name || "Trader",
          email: user.email,
          plan: metadata.plan || "Free",
          watchlists: metadata.watchlist || [],
          portfolio: (metadata.portfolio || []).map((item) => item.symbol),
          portfolio_holdings: metadata.portfolio || [],
        },
      },
      {
        headers: { "cache-control": "private, max-age=0, must-revalidate" },
      }
    );
  } catch (err) {
    console.error("Failed to query user profile from Supabase:", err);
    return Response.json({ ok: false, detail: "Supabase connection error" }, { status: 500 });
  }
}
