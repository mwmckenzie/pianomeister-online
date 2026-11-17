<script setup lang="ts">
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
} from 'reka-ui'

import AppIcon from './AppIcon.vue'

/**
 * Collapsible sections (Reka Accordion, several open at once). Each item's body is the named
 * slot of its value; `changed` shows the primary-colour dot (decision 51).
 */
defineProps<{
  readonly items: readonly {
    readonly value: string
    readonly title: string
    readonly changed?: boolean
  }[]
}>()
const open = defineModel<string[]>({ required: true })
</script>

<template>
  <AccordionRoot v-model="open" type="multiple" class="accordion">
    <AccordionItem v-for="item in items" :key="item.value" :value="item.value" class="item">
      <AccordionHeader as="h3" class="header">
        <AccordionTrigger class="trigger" :data-testid="`accordion-${item.value}`">
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
  animation: accordion-open var(--dur) var(--ease-out);
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

@keyframes accordion-open {
  from {
    height: 0;
    opacity: 0;
  }

  to {
    height: var(--reka-accordion-content-height);
  }
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
