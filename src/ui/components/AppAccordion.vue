<script setup lang="ts">
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { useReducedMotion } from '../theme/useReducedMotion'
import AppIcon from './AppIcon.vue'

/**
 * Collapsible sections, one open at a time (Reka Accordion, single and collapsible): opening
 * one closes the other, clicking the open one's header closes it. Each item's body is the
 * named slot of its value; `changed` shows the primary-colour dot (decision 51).
 *
 * No jump: the section being replaced closes at once (no collapse animation shifting what's
 * below), the opened one fades in at full height, and the scroll area then brings its header
 * to the top — smoothly, or at once under reduced motion.
 */
defineProps<{
  readonly items: readonly {
    readonly value: string
    readonly title: string
    readonly changed?: boolean
  }[]
}>()
const open = defineModel<string | null>({ required: true })
const reducedMotion = useReducedMotion()
const root = ref<HTMLElement | null>(null)
/** True while one section replaces another: the old one closes without animating. */
const switching = ref(false)

const model = computed({
  get: () => open.value ?? undefined,
  set: (value: string | string[] | undefined) => {
    const next = typeof value === 'string' && value !== '' ? value : null
    switching.value = next !== null && open.value !== null
    open.value = next
  },
})

watch(open, (now, before) => {
  if (now === null || now === before) return
  // Two frames: the old section is gone and the new one has its height.
  requestAnimationFrame(() => requestAnimationFrame(() => bringToTop(now)))
})

function bringToTop(value: string): void {
  switching.value = false
  const header = root.value?.querySelector<HTMLElement>(`[data-accordion-item="${value}"]`)
  const scroller = header === null || header === undefined ? null : scrollParent(header)
  if (header === null || header === undefined || scroller === null) return
  const top =
    scroller.scrollTop + header.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  scroller.scrollTo({ top, behavior: reducedMotion.value ? 'instant' : 'smooth' })
}

function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let e = element.parentElement; e !== null; e = e.parentElement) {
    const overflow = getComputedStyle(e).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return e
  }
  return null
}
</script>

<template>
  <div ref="root" class="accordion" :data-switching="switching || undefined">
    <AccordionRoot v-model="model" type="single" collapsible>
      <AccordionItem
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        class="item"
        :data-accordion-item="item.value"
      >
        <AccordionHeader as="h3" class="header">
          <AccordionTrigger class="trigger" data-own-keys :data-testid="`accordion-${item.value}`">
            <span class="title">{{ item.title }}</span>
            <span v-if="item.changed" class="dot" aria-label="has changed settings" />
            <AppIcon class="chevron" name="chevronRight" :size="20" />
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent class="content">
          <div class="inner">
            <slot :name="item.value" />
          </div>
        </AccordionContent>
      </AccordionItem>
    </AccordionRoot>
  </div>
</template>

<style scoped>
.item {
  border-bottom: 1px solid var(--divider);
}

.header {
  margin: 0;
}

.trigger {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 64px;
  padding: 0 var(--space-6);
  border: 0;
  background: transparent;
  color: var(--text-1);
  font-size: var(--text-lg);
  font-weight: var(--weight-regular);
  text-align: left;
  cursor: pointer;
}

.trigger[data-state='open'] .title {
  font-weight: var(--weight-semibold);
}

.title {
  flex: 1;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
}

.chevron {
  color: var(--text-2);
  transition: transform var(--dur) var(--ease-out);
}

.trigger[data-state='open'] .chevron {
  transform: rotate(90deg);
}

.content {
  overflow: hidden;
}

.content[data-state='open'] {
  /* Full height at once (a growing height would stop the scroll short); fades in. */
  animation: pm-fade-in var(--dur) var(--ease-out);
}

/* One section replacing another: the old one goes at once, so nothing below it moves. */
.accordion[data-switching] .content[data-state='closed'] {
  animation: none;
}

.content[data-state='closed'] {
  animation: accordion-close var(--dur-fast) var(--ease-in);
}

:root[data-motion='reduced'] .content[data-state='open'] {
  animation: pm-fade-in var(--dur) var(--ease-out);
}

:root[data-motion='reduced'] .content[data-state='closed'] {
  animation: none;
}

.inner {
  padding: 0 var(--space-6) var(--space-3);
}

@keyframes accordion-close {
  from {
    height: var(--reka-accordion-content-height);
  }

  to {
    height: 0;
    opacity: 0;
  }
}
</style>
