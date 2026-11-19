<script setup lang="ts">
import { computed } from 'vue'

import type { CommandId } from '@/core/commands/CommandId'

import { useSettingsStore } from '../stores/settingsStore'
import { LIST_ROLES } from './LIST_ROLES'

/**
 * "Lists on each page" (brief decision 90) for the Shortcuts tab and the cheat sheet: a table
 * where there's room, one block per page below ~720 px (a container query, so it follows the
 * space it gets, not the window).
 */
const settings = useSettingsStore()

/** "↑ ↓" from the keys in effect, or "—" when neither command has a key. */
function pair(next: CommandId, previous: CommandId): string {
  const keys = [settings.shortcutLabel(previous), settings.shortcutLabel(next)].filter(Boolean)
  return keys.length === 0 ? '—' : keys.join(' ')
}

const keys = computed(() => ({
  main: pair('listNext', 'listPrevious'),
  side: pair('secondaryNext', 'secondaryPrevious'),
  open: settings.shortcutLabel('listOpen') || '—',
}))
</script>

<template>
  <div class="roles" data-testid="list-roles">
    <table class="wide">
      <thead>
        <tr>
          <th scope="col">Page</th>
          <th scope="col">
            Main list <kbd>{{ keys.main }}</kbd>
          </th>
          <th scope="col">
            Side list <kbd>{{ keys.side }}</kbd>
          </th>
          <th scope="col">
            <kbd>{{ keys.open }}</kbd>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in LIST_ROLES" :key="r.page">
          <th scope="row">{{ r.page }}</th>
          <td>{{ r.main }}</td>
          <td>{{ r.side }}</td>
          <td>{{ r.open }}</td>
        </tr>
      </tbody>
    </table>
    <div class="stacked">
      <dl v-for="r in LIST_ROLES" :key="r.page" class="page">
        <dt class="page-name">{{ r.page }}</dt>
        <dd>
          Main list <kbd>{{ keys.main }}</kbd>: {{ r.main }}
        </dd>
        <dd>
          Side list <kbd>{{ keys.side }}</kbd>: {{ r.side }}
        </dd>
        <dd>
          <kbd>{{ keys.open }}</kbd>: {{ r.open }}
        </dd>
      </dl>
    </div>
  </div>
</template>

<style scoped>
.roles {
  container-type: inline-size;
  min-width: 0;
  font-size: var(--text-xs);
}

.wide {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 4px 8px 4px 0;
  border-bottom: 1px solid var(--divider);
  color: var(--text-3);
  font-weight: normal;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

thead th {
  color: var(--text-4);
}

tbody th {
  color: var(--text-2);
}

.stacked {
  display: none;
  gap: var(--space-2);
}

.page {
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--divider);
}

.page-name {
  color: var(--text-2);
}

.page dd {
  margin: 2px 0 0;
  color: var(--text-3);
  overflow-wrap: anywhere;
}

kbd {
  padding: 0 5px;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  background: var(--field);
  color: var(--text-1);
  font-family: inherit;
  white-space: nowrap;
}

@container (width < 720px) {
  .wide {
    display: none;
  }

  .stacked {
    display: grid;
  }
}
</style>
