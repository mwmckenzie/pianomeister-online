<script setup lang="ts">
import BeatDots from './BeatDots.vue'

/**
 * "bar 18:2 beat" with the beat dots. The bar and beat numbers sit in fixed-width slots measured
 * in the big font's own `ch` (tabular digits): the bar slot fits the song's highest bar number
 * (right-aligned), the beat slot its largest beat count. With fixed 8 px gaps to the labels,
 * nothing moves sideways as the numbers change.
 */
defineProps<{
  readonly bar: number
  readonly beat: number
  /** Counting in: the bar and beat are the target's (beat 1), shown dimmed. */
  readonly preRoll: boolean
  /** What the dots show: the bar's beats, or the count-in's. */
  readonly dotBeat: number
  readonly dotBeats: number
  /** Digits of the song's highest bar number. */
  readonly barDigits: number
  /** Digits of the song's largest beat count. */
  readonly beatDigits: number
}>()
</script>

<template>
  <p
    class="bar-beat"
    :class="{ 'pre-roll': preRoll }"
    :aria-label="preRoll ? `Count-in before bar ${bar}` : `Bar ${bar}, beat ${beat}`"
    :data-pre-roll="preRoll"
    data-testid="hud-counter"
  >
    <span class="unit">bar</span>
    <span class="numerals" data-testid="hud-bar-beat"
      ><span class="slot bar" :style="{ width: `${barDigits}ch` }" data-testid="hud-bar">{{
        bar
      }}</span
      ><span class="sep" data-testid="hud-bar-beat-sep">:</span
      ><span class="slot beat" :style="{ width: `${beatDigits}ch` }">{{ beat }}</span></span
    >
    <span class="unit">beat</span>
    <BeatDots :beats="dotBeats" :beat="dotBeat" />
  </p>
</template>

<style scoped>
.bar-beat {
  display: flex;
  align-items: baseline;
  margin: 10px 0 0;
  line-height: 1;
}

.pre-roll .numerals,
.pre-roll .unit {
  opacity: 0.45;
}

.numerals {
  display: inline-flex;
  align-items: baseline;
  margin: 0 8px;
  font-size: var(--text-hero);
  font-weight: var(--weight-light);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  text-shadow: var(--text-shadow-hud-number);
}

.slot {
  display: inline-block;
  white-space: nowrap;
}

.slot.bar {
  text-align: right;
}

.slot.beat {
  text-align: left;
}

.sep {
  margin: 0 1px;
}

.sep,
.beat {
  color: #7f89a3;
}

.unit {
  color: var(--text-4);
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
}

.bar-beat .beat-dots {
  margin-left: 14px;
}
</style>
