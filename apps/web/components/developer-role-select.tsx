"use client";

interface Props {
  action: (formData: FormData) => Promise<void>;
  defaultValue: string;
}

export function DeveloperRoleSelect({ action, defaultValue }: Props) {
  return (
    <form action={action}>
      <select
        name="role"
        defaultValue={defaultValue}
        onChange={(e) => {
          const form = e.currentTarget.form!;
          form.requestSubmit();
        }}
        className="h-7 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="developer">Developer</option>
        <option value="tech_lead">Tech Lead</option>
      </select>
    </form>
  );
}
