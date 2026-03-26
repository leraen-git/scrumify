"use client";

export function MoveSprintSelect({
  plannedSprints,
  action,
}: {
  plannedSprints: { id: string; name: string }[];
  action: (formData: FormData) => Promise<void>;
}) {
  if (plannedSprints.length === 0) return null;
  return (
    <form action={action}>
      <select
        name="toSprintId"
        defaultValue=""
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-[10px] rounded border border-gray-200 bg-white text-gray-500 px-1 py-0.5 cursor-pointer"
      >
        <option value="" disabled>↩ move</option>
        {plannedSprints.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </form>
  );
}
