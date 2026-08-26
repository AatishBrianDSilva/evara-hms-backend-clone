import { format, toZonedTime, fromZonedTime } from 'date-fns-tz';

export function formatDateIST(
  dateString: string,
  formatString = 'dd-MM-yyyy hh:mm a',
) {
  if (!dateString) return '';

  console.log('dateString', dateString);
  console.log('formatString', formatString);

  // Convert to JS Date
  const dateObj = new Date(dateString);

  // Convert this UTC date/time to IST using date-fns-tz
  const zonedDate = toZonedTime(dateObj, 'Asia/Kolkata');

  // Format the zoned date/time in the desired pattern
  return format(zonedDate, formatString, { timeZone: 'Asia/Kolkata' });
}

export function formatTimeIST(dateString: string, timeFormat = 'hh:mm a') {
  if (!dateString) return '';
  console.log('dateString', dateString);
  console.log('timeFormat', timeFormat);

  // Convert to JS Date object
  const dateObj = new Date(dateString);

  // Convert the date/time to IST (Asia/Kolkata)
  const zonedDate = toZonedTime(dateObj, 'Asia/Kolkata');

  // Format the date/time as only the time in the given format
  return format(zonedDate, timeFormat, { timeZone: 'Asia/Kolkata' });
}

const IST = 'Asia/Kolkata';

/**
 * Build inclusive UTC Date bounds for a calendar day/range as seen in India (IST).
 * Use for Mongo `$gte` / `$lte` filters so "today" / monthly ranges match clinic local days.
 */
export function getISTDateRangeBounds(
  startDate?: string | Date | null,
  endDate?: string | Date | null,
): { start?: Date; end?: Date } {
  const result: { start?: Date; end?: Date } = {};

  if (startDate) {
    const zoned = toZonedTime(new Date(startDate), IST);
    const y = zoned.getFullYear();
    const m = zoned.getMonth();
    const d = zoned.getDate();
    // Midnight IST → UTC instant
    result.start = fromZonedTime(new Date(y, m, d, 0, 0, 0, 0), IST);
  }

  if (endDate) {
    const zoned = toZonedTime(new Date(endDate), IST);
    const y = zoned.getFullYear();
    const m = zoned.getMonth();
    const d = zoned.getDate();
    // End of day IST → UTC instant
    result.end = fromZonedTime(new Date(y, m, d, 23, 59, 59, 999), IST);
  }

  return result;
}
