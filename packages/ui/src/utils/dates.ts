/**
 * Various formats for dates.
 */
export enum DateFormat {
  /**
   * This one will format a date like this: "January 1, 2021"
   */
  MonthDayYear = 'month-day-year',
}

/**
 * Mapping month numbers to names.
 */
const months: { [key: number]: string } = {
  0: 'January',
  1: 'February',
  2: 'March',
  3: 'April',
  4: 'May',
  5: 'June',
  6: 'July',
  7: 'August',
  8: 'September',
  9: 'October',
  10: 'November',
  11: 'December',
};

/**
 * Formats a date. If no date is provided, the current date will be used. First argument
 * is required, however.
 */
export function formatDate(format: DateFormat, date: Date = new Date()) {
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}
