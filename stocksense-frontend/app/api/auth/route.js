import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const cookieStore = await cookies();

    if (mode === "logout") {
      cookieStore.delete("stocksense_token");
      await supabase.auth.signOut();
      return Response.json({ ok: true, message: "Logged out successfully." });
    }

    const body = await request.json();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: body.email.trim().toLowerCase(),
        password: body.password,
        options: {
          data: {
            name: body.name || "Trader",
            plan: body.plan || "",
            watchlist: [],
            portfolio: [],
          },
        },
      });

      if (error) {
        return Response.json({ ok: false, detail: error.message }, { status: 400 });
      }

      const session = data?.session;
      if (!session) {
        // If email confirmation is enabled, signup succeeds but session isn't automatic
        return Response.json({
          ok: true,
          sessionCreated: false,
          message: "Registration successful! Please check your email inbox to verify your account before logging in.",
        });
      }

      // Set cookie on success
      cookieStore.set({
        name: "stocksense_token",
        value: session.access_token,
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: "lax",
      });

      return Response.json({ ok: true, sessionCreated: true, message: "Registration successful!" });
    }

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email.trim().toLowerCase(),
        password: body.password,
      });

      if (error) {
        return Response.json({ ok: false, detail: error.message }, { status: 400 });
      }

      const session = data?.session;
      if (!session) {
        return Response.json({ ok: false, detail: "Login failed - session not established." }, { status: 400 });
      }

      // Set cookie on success
      cookieStore.set({
        name: "stocksense_token",
        value: session.access_token,
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: "lax",
      });

      return Response.json({ ok: true, message: "Login successful!" });
    }

    return Response.json({ ok: false, detail: "Invalid auth mode." }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, detail: err.message }, { status: 500 });
  }
}
