"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Category {
  key: string;
  label: string;
  color: string;
  count: number;
}

interface Props {
  categories: Category[];
}

export function KanbanCategoryFilter({ categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selected = new Set(
    (searchParams.get("categories") ?? "").split(",").filter(Boolean)
  );

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);

      const params = new URLSearchParams(searchParams.toString());
      if (next.size > 0) params.set("categories", [...next].join(","));
      else params.delete("categories");

      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [selected, searchParams, router]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("categories");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={clearAll}
        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
          selected.size === 0
            ? "bg-gray-900 text-white border-gray-900"
            : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
        }`}
      >
        All
      </button>
      {categories.map((cat) => {
        const active = selected.has(cat.key);
        return (
          <button
            key={cat.key}
            onClick={() => toggle(cat.key)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              active
                ? "text-white border-transparent"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
            style={active ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: active ? "white" : cat.color }}
            />
            {cat.label}
            <span className={`${active ? "opacity-70" : "text-gray-400"}`}>
              {cat.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
