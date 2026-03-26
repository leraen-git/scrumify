"use server";

import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { setAuthCookies } from "@/lib/auth-cookies";

const API_URL = process.env.API_INTERNAL_URL ?? "https://localhost:3001";

async function loginAction(prevState: string | null, formData: FormData): Promise<string | null> {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return "Cannot reach server. Try again.";
  }

  if (!apiRes.ok) {
    const data = await apiRes.json().catch(() => ({}));
    return (data.message as string) ?? "Invalid credentials";
  }

  await setAuthCookies(apiRes.headers.getSetCookie?.() ?? []);
  redirect("/");
}

export default async function LoginPage() {
  return <LoginForm action={loginAction} />;
}
