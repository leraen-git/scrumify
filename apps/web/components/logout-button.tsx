"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:3001";
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleLogout}
      disabled={pending}
      className="text-gray-400 hover:text-red-500 transition-colors"
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
