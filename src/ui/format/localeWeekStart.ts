/**
 * The first day of the week for the user's locale (m7-7 decision 7): 0 = Sunday … 6 = Saturday.
 * Uses Intl.Locale week info where the browser has it (getWeekInfo, or the older weekInfo),
 * else Monday.
 */
export function localeWeekStart(locale: string = navigator.language): number {
  try {
    const intl = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const firstDay = intl.getWeekInfo?.().firstDay ?? intl.weekInfo?.firstDay
    // Intl numbers days 1 (Monday) … 7 (Sunday).
    if (firstDay !== undefined) return firstDay % 7
  } catch {
    // An unknown locale tag: fall through.
  }
  return 1
}
