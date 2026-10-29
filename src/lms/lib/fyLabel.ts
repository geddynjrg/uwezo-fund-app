/** Kenya FY runs July–June; quarters match live LMS badge text. */
export function currentFyLabel(date = new Date()): string {
  const month = date.getMonth(); // 0-based
  const year = date.getFullYear();
  const fyStart = month >= 6 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const quarter = month >= 6 ? Math.floor((month - 6) / 3) + 1 : Math.floor(month / 3) + 3;
  const suffix = ['1st', '2nd', '3rd', '4th'][quarter - 1] || `${quarter}th`;
  return `FY ${fyStart}/${fyEnd} - ${suffix} Quarter`;
}
