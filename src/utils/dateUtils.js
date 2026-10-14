import { getBusinessDateISO } from "./regional";
export function getRangeStart(period) {
  const [year, month, day] = getBusinessDateISO().split("-").map(Number);
  const now = new Date(year, month - 1, day);
  if (period === 1) {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  if (period === 2) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === 3) {
    const startYear = month >= 4 ? year : year - 1;
    return new Date(startYear, 3, 1);
  }
  return null;
}
