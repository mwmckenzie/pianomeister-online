/**
 * The bands of "When you practise" (m7-7 decision 19), by local hour: morning 5–11, midday
 * 11–14, afternoon 14–18, evening 18–23, night 23–5.
 */
export const TIME_BANDS = [
  { id: 'morning', label: 'Morning', short: 'M', from: 5 },
  { id: 'midday', label: 'Midday', short: 'Mi', from: 11 },
  { id: 'afternoon', label: 'Afternoon', short: 'A', from: 14 },
  { id: 'evening', label: 'Evening', short: 'E', from: 18 },
  { id: 'night', label: 'Night', short: 'N', from: 23 },
] as const
