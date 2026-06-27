import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function POST(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("stocksense_token")?.value;

  if (!token) {
    return Response.json({ ok: false, detail: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return Response.json({ ok: false, detail: "Session invalid." }, { status: 401 });
    }

    const body = await request.json();
    const symbol = (body.symbol || "").trim().toUpperCase();
    const shares = Number(body.shares);
    const avgPrice = Number(body.avg_price);

    if (!symbol) {
      return Response.json({ ok: false, detail: "Symbol is required." }, { status: 400 });
    }

    const metadata = user.user_metadata || {};
    let portfolio = metadata.portfolio || [];

    if (shares <= 0) {
      portfolio = portfolio.filter((item) => item.symbol !== symbol);
    } else {
      const existsIdx = portfolio.findIndex((item) => item.symbol === symbol);
      if (existsIdx > -1) {
        portfolio[existsIdx] = { symbol, shares, avg_price: avgPrice };
      } else {
        portfolio.push({ symbol, shares, avg_price: avgPrice });
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: { ...metadata, portfolio },
    });

    if (updateError) {
      return Response.json({ ok: false, detail: updateError.message }, { status: 400 });
    }

    return Response.json({ ok: true, message: `Updated holding for '${symbol}'.` });
  } catch (err) {
    return Response.json({ ok: false, detail: err.message }, { status: 500 });
  }
}
