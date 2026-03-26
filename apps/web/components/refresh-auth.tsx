"use client";

import { useEffect } from "react";

export function RefreshAuth() {
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:3001";
    fetch(`${apiUrl}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {/* no session — that's fine */});
  }, []);

  return null;
}
