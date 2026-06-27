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

    if (!symbol) {
      return Response.json({ ok: false, detail: "Symbol is required." }, { status: 400 });
    }

    const metadata = user.user_metadata || {};
    const watchlist = metadata.watchlist || [];

    if (watchlist.includes(symbol)) {
      return Response.json({ ok: true, message: `Symbol '${symbol}' is already on the watchlist.` });
    }

    const updatedWatchlist = [...watchlist, symbol];
    const { error: updateError } = await supabase.auth.updateUser({
      data: { ...metadata, watchlist: updatedWatchlist },
    });

    if (updateError) {
      return Response.json({ ok: false, detail: updateError.message }, { status: 400 });
    }

    return Response.json({ ok: true, message: `Added '${symbol}' to watchlist.` });
  } catch (err) {
    return Response.json({ ok: false, detail: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
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

    const { searchParams } = new URL(request.url);
    let symbol = searchParams.get("symbol");

    if (!symbol) {
      try {
        const body = await request.json();
        symbol = body.symbol;
      } catch {}
    }

    symbol = (symbol || "").trim().toUpperCase();
    if (!symbol) {
      return Response.json({ ok: false, detail: "Symbol is required." }, { status: 400 });
    }

    const metadata = user.user_metadata || {};
    const watchlist = metadata.watchlist || [];

    if (!watchlist.includes(symbol)) {
      return Response.json({ ok: false, detail: `Symbol '${symbol}' not found in watchlist.` }, { status: 404 });
    }

    const updatedWatchlist = watchlist.filter((s) => s !== symbol);
    const { error: updateError } = await supabase.auth.updateUser({
      data: { ...metadata, watchlist: updatedWatchlist },
    });

    if (updateError) {
      return Response.json({ ok: false, detail: updateError.message }, { status: 400 });
    }

    return Response.json({ ok: true, message: `Removed '${symbol}' from watchlist.` });
  } catch (err) {
    return Response.json({ ok: false, detail: err.message }, { status: 500 });
  }
}
