import { NextRequest, NextResponse } from "next/server";

// Paths that never require authentication
const PUBLIC_PREFIXES = ["/login", "/access", "/api/", "/_next/", "/favicon"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // RSC navigations and prefetch requests don't carry cookies in VS Code's browser.
  // Let them through — page-level server components handle their own data auth.
  // Only full-page loads get the redirect-to-login treatment.
  const isRSC = req.headers.has("rsc") || req.headers.has("next-router-prefetch");
  if (isRSC) return NextResponse.next();

  const ctx = req.cookies.get("argo_ctx")?.value ?? "";

  // No session → login
  if (!ctx) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const isUser = ctx.startsWith("user:");

  // Root redirect
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    if (isUser) {
      const teamId = ctx.split(":")[1];
      url.pathname = teamId ? `/teams/${teamId}` : "/login";
    } else {
      url.pathname = "/admin";
    }
    return NextResponse.redirect(url);
  }

  // Admin-only area: block users
  if (pathname.startsWith("/admin") && isUser) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Users can only access their assigned team
  if (pathname.startsWith("/teams/") && isUser) {
    const teamId = ctx.split(":")[1];
    const urlTeamId = pathname.split("/")[2];
    if (teamId && urlTeamId && urlTeamId !== teamId) {
      const url = req.nextUrl.clone();
      url.pathname = `/teams/${teamId}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
