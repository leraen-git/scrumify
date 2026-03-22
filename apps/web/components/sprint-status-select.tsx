"use client";

import { useTransition } from "react";

interface Props {
  currentStatus: string;
  options: string[];
  action: (formData: FormData) => Promise<void>;
}

export function SprintStatusSelect({ currentStatus, options, action }: Props) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const formData = new FormData();
    formData.set("status", e.target.value);
    startTransition(() => action(formData));
  }

  return (
    <select
      defaultValue={currentStatus}
      disabled={pending}
      onChange={handleChange}
      className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}
