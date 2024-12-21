import { format, toZonedTime } from 'date-fns-tz';

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
