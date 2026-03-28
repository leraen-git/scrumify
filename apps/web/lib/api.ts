export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = typeof window === "undefined"
    ? (process.env.API_INTERNAL_URL ?? "http://localhost:3001")
    : (process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:3001");

  // Server-side: forward the session cookie from the incoming request
  let cookieHeader: string | undefined;
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const session = store.get("argo_session");
    if (session) cookieHeader = `argo_session=${session.value}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status} ${path}: ${text}`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}
