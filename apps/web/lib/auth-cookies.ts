import { cookies } from "next/headers";

export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
  // Only require Secure in production — VS Code's embedded browser drops
  // Secure cookies on navigation when using a self-signed cert in dev.
  secure: process.env.NODE_ENV === "production",
};

export async function setAuthCookies(apiSetCookie: string[]) {
  const cookieStore = await cookies();
  for (const raw of apiSetCookie) {
    const [nameVal] = raw.split(";");
    const [name, ...rest] = nameVal.split("=");
    const value = decodeURIComponent(rest.join("="));
    cookieStore.set(name.trim(), value.trim(), COOKIE_OPTS);
  }
}
