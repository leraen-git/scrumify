import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const apiRes = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!apiRes.ok) {
    const data = await apiRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: apiRes.status });
  }

  const data = await apiRes.json();
  const apiSetCookie = apiRes.headers.getSetCookie?.() ?? [];
  const res = NextResponse.json(data);

  for (const raw of apiSetCookie) {
    const [nameVal] = raw.split(";");
    const [name, ...rest] = nameVal.split("=");
    const value = rest.join("=");
    res.cookies.set(name.trim(), value.trim(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      secure: true,
    });
  }

  return res;
}
