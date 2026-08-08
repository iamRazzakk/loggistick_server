import { eachDayOfInterval, format, parseISO } from "date-fns";

export const generateRecurringDates = (
  startDate: string,
  endDate: string,
  selectedDays: string[],
): string[] => {
  if (!selectedDays || selectedDays.length === 0) {
    return [];
  }

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const selectedDaysSet = new Set(selectedDays.map((day) => day?.toLowerCase()));

  const dates = eachDayOfInterval({
    start,
    end,
  });

  return dates
    .filter((date) => {
      const dayName = format(date, "EEEE").toLowerCase();
      return selectedDaysSet.has(dayName);
    })
    .map((date) => format(date, "yyyy-MM-dd"));
};
