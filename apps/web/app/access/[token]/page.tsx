"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AccessPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/auth/access`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Invalid or expired access link");
        const data = await res.json();
        // Flush the router cache so the nav re-renders with the new user cookie
        router.refresh();
        if (data.assignedTeamId) {
          router.replace(`/teams/${data.assignedTeamId}`);
        } else {
          router.replace("/teams");
        }
      })
      .catch((err) => setError(err.message));
  }, [params.token, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm text-center">
          <p className="text-red-500 font-medium mb-2">Access denied</p>
          <p className="text-sm text-gray-500">{error}</p>
          <a href="/login" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
            Go to admin login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Signing you in…</p>
    </div>
  );
}
