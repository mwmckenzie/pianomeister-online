<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { weekComparison } from '@/core/insights/weekComparison'
import { weekdayOfKey } from '@/core/insights/weekdayOfKey'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'

import BarChart from '../charts/BarChart.vue'
import { bigDuration } from '../format/bigDuration'
import { dayLabel } from '../format/dayLabel'
import { usePracticeDays } from '../stats/usePracticeDays'

/**
 * "This week" (QGWelcomeA, m7-7 decision 7): minutes in the calendar week so far (the locale's
 * first day), the change against the same days of last week (hidden when last week had none),
 * and a 7-day chart, today in the primary colour.
 */
const { today, byDay, weekStart } = usePracticeDays()
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const week = computed(() => weekComparison(byDay.value, today.value, weekStart))
const total = computed(() => bigDuration(week.value.thisWeekMs))
const change = computed(() => {
  const c = week.value.change
  if (c === null) return ''
  const pct = Math.round(c * 100)
  return `${pct > 0 ? '+' : ''}${pct}% vs last week`
})
const bars = computed(() =>
  week.value.days.map((d) => ({
    key: d.key,
    value: (d.ms ?? 0) / 60_000,
    label: dayLabel(d.key),
    valueText: d.ms === null ? '' : d.ms > 0 ? formatPracticeTime(d.ms) : 'No practice',
    current: d.key === today.value,
    future: d.ms === null,
    axis: LETTERS[weekdayOfKey(d.key)],
  })),
)
</script>

<template>
  <section class="card glass" aria-labelledby="week-heading" data-testid="week-card">
    <header class="head">
      <h2 id="week-heading" class="section-caps">This week</h2>
      <RouterLink :to="{ name: 'stats' }" class="more" data-testid="see-all-stats"
        >See all stats</RouterLink
      >
    </header>
    <p class="total">
      <span class="value" data-testid="week-total">{{ total.value }}</span>
      <span class="unit">{{ total.unit }}</span>
      <span
        v-if="change"
        class="change"
        :class="{ up: (week.change ?? 0) > 0 }"
        data-testid="week-change"
        >{{ change }}</span
      >
    </p>
    <BarChart
      :bars="bars"
      :height="70"
      :max-bar-width="32"
      label="Practice minutes this week"
      data-testid="week-chart"
    />
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 300px;
  padding: 18px 20px;
  border-radius: 18px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head .section-caps {
  margin: 0;
}

.more {
  color: var(--text-3);
  font-size: 12px;
  text-decoration: none;
}

.more:hover {
  color: var(--text-1);
  text-decoration: underline;
}

.total {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.value {
  font-size: 34px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}

.unit {
  color: var(--text-2);
  font-size: 13px;
}

.change {
  margin-left: auto;
  color: var(--text-2);
  font-size: 13px;
}

/* As QGWelcomeA: a rise in the secondary colour (the text says it, the colour only echoes it). */
.change.up {
  color: var(--secondary);
}
</style>
