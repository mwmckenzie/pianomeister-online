<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

/**
 * Tabs on the left, the active tab's content on the right (Reka Tabs, vertical). Each tab's
 * content is the named slot of its value; `#nav-footer` sits under the tab list and `#footer`
 * under the content. `changed` shows the primary-colour dot (decision 51).
 */
defineProps<{
  readonly title: string
  readonly tabs: readonly {
    readonly value: string
    readonly title: string
    readonly changed?: boolean
  }[]
}>()
const active = defineModel<string>({ required: true })
</script>

<template>
  <TabsRoot v-model="active" orientation="vertical" class="tabbed" :unmount-on-hide="true">
    <nav class="nav">
      <h2 class="window-title">{{ title }}</h2>
      <TabsList class="tab-list" :aria-label="title">
        <TabsTrigger
          v-for="tab in tabs"
          :key="tab.value"
          :value="tab.value"
          class="tab"
          :data-testid="`tab-${tab.value}`"
        >
          <span>{{ tab.title }}</span>
          <span v-if="tab.changed" class="dot" aria-label="has changed settings" />
        </TabsTrigger>
      </TabsList>
      <div class="nav-footer">
        <slot name="nav-footer" />
      </div>
    </nav>
    <div class="main">
      <slot name="header" />
      <TabsContent v-for="tab in tabs" :key="tab.value" :value="tab.value" class="panel">
        <slot :name="tab.value" />
      </TabsContent>
      <slot name="footer" />
    </div>
  </TabsRoot>
</template>

<style scoped>
.tabbed {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 0;
  height: 100%;
}

.nav {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 22px 12px;
  border-right: 1px solid var(--divider);
}

.window-title {
  margin: 0 12px 16px;
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
}

.tab-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-size: var(--text-base);
  text-align: left;
  cursor: pointer;
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}

.tab:hover {
  color: var(--text-1);
}

.tab[data-state='active'] {
  background: rgb(var(--primary-rgb) / 16%);
  color: var(--text-1);
  font-weight: var(--weight-medium);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
}

.nav-footer {
  margin-top: auto;
  padding: 14px 12px 0;
  border-top: 1px solid var(--divider);
}

.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 30px 20px;
}

.panel:focus-visible {
  box-shadow: none;
}
</style>
