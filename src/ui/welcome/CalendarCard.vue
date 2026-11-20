<script setup lang="ts">
import { computed } from 'vue'

import { heatmapWeeks } from '@/core/insights/heatmapWeeks'
import { practiceStreaks } from '@/core/insights/practiceStreaks'

import AppIcon from '../components/AppIcon.vue'
import HeatmapGrid from '../charts/HeatmapGrid.vue'
import { usePracticeDays } from '../stats/usePracticeDays'

/**
 * "Last 12 weeks" (QGWelcomeA, m7-7 decision 8): the practice calendar and the current streak
 * ("4 days in a row", counting while today or yesterday was practised; hidden at 0).
 */
const { today, byDay, weekStart } = usePracticeDays()

const weeks = computed(() => heatmapWeeks(byDay.value, today.value, 12, weekStart))
const streak = computed(() => {
  const days = new Set([...byDay.value].filter(([, ms]) => ms > 0).map(([key]) => key))
  return practiceStreaks(days, today.value).current
})
</script>

<template>
  <section class="card glass" aria-labelledby="calendar-heading" data-testid="calendar-card">
    <header class="head">
      <h2 id="calendar-heading" class="section-caps">Last 12 weeks</h2>
      <span v-if="streak > 0" class="streak" data-testid="streak">
        <AppIcon name="flame" :size="16" />
        {{ streak === 1 ? '1 day' : `${streak} days` }} in a row
      </span>
    </header>
    <HeatmapGrid :weeks="weeks" label="Practice calendar, last 12 weeks" />
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.streak {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--secondary);
  font-size: 13px;
}
</style>
