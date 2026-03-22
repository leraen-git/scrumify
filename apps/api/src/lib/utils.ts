export function countWorkingDays(startDate: string, endDate: string): number {
  let count = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function calcSprintCapacity(
  developers: { storyPointsPerSprint: number; daysOff: { date: string; type: string }[] }[],
  sprintDuration: number,
  startDate: string,
  endDate: string,
): number {
  const workingDays = countWorkingDays(startDate, endDate);
  const fullSprintDays = sprintDuration * 5;
  return Math.round(
    developers.reduce((total, dev) => {
      const daysOffInSprint = dev.daysOff
        .filter((d) => d.date >= startDate && d.date <= endDate)
        .reduce((s, d) => s + (d.type === 'half' ? 0.5 : 1), 0);
      const effectiveDays = Math.max(0, workingDays - daysOffInSprint);
      return total + (dev.storyPointsPerSprint * effectiveDays) / fullSprintDays;
    }, 0),
  );
}
