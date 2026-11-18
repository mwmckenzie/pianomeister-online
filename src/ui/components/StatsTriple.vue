<script setup lang="ts">
/** Three stats side by side, e.g. Played / Practice / Last (QGPicker source sizes). */
defineProps<{
  readonly items: readonly {
    readonly label: string
    readonly value: string
    readonly testid?: string
  }[]
}>()
</script>

<template>
  <dl class="stats-triple">
    <div v-for="item in items" :key="item.label">
      <dt>{{ item.label }}</dt>
      <dd :data-testid="item.testid">{{ item.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.stats-triple {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

dt {
  color: var(--text-3);
  font-size: var(--text-xs);
}

dd {
  margin: 2px 0 0;
  overflow: hidden;
  /* 20 px as in the source; smaller in the narrower 1024 px columns. */
  font-size: clamp(15px, 1.6vw, 20px);
  text-overflow: ellipsis;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
