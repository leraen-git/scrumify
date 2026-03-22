"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface Props {
  sprintDuration: number;
  defaultStartISO: string;
  defaultEndISO: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SprintDatePicker({ sprintDuration, defaultStartISO, defaultEndISO }: Props) {
  const [startISO, setStartISO] = useState(defaultStartISO);
  const [endISO, setEndISO] = useState(defaultEndISO);

  function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newStart = e.target.value;
    setStartISO(newStart);
    if (newStart) {
      setEndISO(addDays(newStart, sprintDuration * 7 - 1));
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          value={startISO}
          onChange={handleStartChange}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endDate">End Date</Label>
        <Input
          id="endDate"
          name="endDate"
          type="date"
          value={endISO}
          onChange={(e) => setEndISO(e.target.value)}
          required
        />
      </div>
    </div>
  );
}
