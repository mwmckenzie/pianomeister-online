import { computed } from 'vue'

import { dayKeyOf } from '@/core/insights/dayKeyOf'
import { practiceByDay } from '@/core/insights/practiceByDay'

import { localeWeekStart } from '../format/localeWeekStart'
import { useStatsStore } from '../stores/statsStore'

/**
 * The active profile's practice per local day, today's key and the locale's week start — what
 * Welcome and the stats page build their numbers on (m7-7 decision 23: always from the play log,
 * in local calendar days).
 */
export function usePracticeDays() {
  const stats = useStatsStore()
  const weekStart = localeWeekStart()
  const today = computed(() => dayKeyOf()(stats.now))
  const byDay = computed(() => practiceByDay(stats.records))
  return { stats, weekStart, today, byDay }
}
