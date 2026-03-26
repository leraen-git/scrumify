import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_INTERNAL_URL ?? "https://localhost:3001";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("scrumify_session");

  // Call API to invalidate the session in the DB
  if (session) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: `scrumify_session=${session.value}` },
    }).catch(() => null);
  }

  // Clear both cookies on the :3000 domain
  const res = NextResponse.json({ ok: true });
  res.cookies.set("scrumify_session", "", { maxAge: 0, path: "/" });
  res.cookies.set("scrumify_ctx", "", { maxAge: 0, path: "/" });
  return res;
}
