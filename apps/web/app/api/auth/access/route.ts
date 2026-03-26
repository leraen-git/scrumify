import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";

const API_URL = process.env.API_INTERNAL_URL ?? "https://localhost:3001";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const apiRes = await fetch(`${API_URL}/api/auth/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!apiRes.ok) {
    const data = await apiRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: apiRes.status });
  }

  const data = await apiRes.json();
  await setAuthCookies(apiRes.headers.getSetCookie?.() ?? []);
  return NextResponse.json(data);
}
