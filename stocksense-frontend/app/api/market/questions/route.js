import { getDynamicQuestions } from "@/lib/server/marketData";
import { sanitizeUser } from "@/lib/server/utils";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = sanitizeUser(searchParams.get("user"));
    const data = getDynamicQuestions(user);

    return Response.json(
      { ok: true, data },
      {
        headers: {
          "cache-control": "private, max-age=0, must-revalidate",
        },
      }
    );
  } catch {
    return Response.json(
      { ok: false, error: "Unable to load questions" },
      { status: 500 }
    );
  }
}

