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

    let body = {};
    try {
      body = await request.json();
    } catch {}

    const plan = body.plan || "Pro";
    const planClean = plan.trim().charAt(0).toUpperCase() + plan.trim().slice(1).toLowerCase();
    if (!["Free", "Pro", "Analyst"].includes(planClean)) {
      return Response.json({ ok: false, detail: "Invalid plan selected." }, { status: 400 });
    }

    const metadata = user.user_metadata || {};
    const { error: updateError } = await supabase.auth.updateUser({
      data: { ...metadata, plan: planClean },
    });

    if (updateError) {
      return Response.json({ ok: false, detail: updateError.message }, { status: 400 });
    }

    return Response.json({
      ok: true,
      message: `Successfully updated to ${planClean} Plan!`,
      plan: planClean,
    });
  } catch (err) {
    console.error("Failed to upgrade plan in Supabase:", err);
    return Response.json({ ok: false, detail: "Supabase connection error" }, { status: 500 });
  }
}
