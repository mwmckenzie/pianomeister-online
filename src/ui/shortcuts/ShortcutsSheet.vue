<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { COMMANDS } from '@/core/commands/COMMANDS'
import { commandForEvent } from '@/core/commands/shortcutBindings'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStateStore } from '../stores/uiStateStore'
import ListRolesTable from './ListRolesTable.vue'
import { SHORTCUT_GROUPS } from './SHORTCUT_GROUPS'
import { useListeningStore } from '../stores/listeningStore'

/**
 * The keyboard shortcuts cheat sheet (brief decision 89): every command with its keys in effect,
 * grouped by scope. "Change shortcuts…" opens Settings → Shortcuts; Esc or its own key closes it.
 */
const settings = useSettingsStore()
const ui = useUiStateStore()
const route = useRoute()
const router = useRouter()

const listening = useListeningStore()
// The Listening keys only while listening (milestone 9.5); the Shortcuts tab always lists them.
const groups = computed(() =>
  SHORTCUT_GROUPS.filter((group) => group.scope !== 'listening' || listening.active).map(
    (group) => ({
      ...group,
      commands: COMMANDS.filter((c) => c.scope === group.scope).map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
        keys: (settings.bindings.get(c.id) ?? []).map((b) => settings.keyLabel(b)),
      })),
    }),
  ),
)

function onKeyDown(event: KeyboardEvent): void {
  if (commandForEvent(settings.bindings, 'app', event) !== 'showShortcuts') return
  event.preventDefault()
  ui.shortcutsOpen = false
}

/** The settings window lives in the player: go there if needed, then open its Shortcuts tab. */
function changeShortcuts(): void {
  ui.shortcutsOpen = false
  ui.settingsTabRequest = 'shortcuts'
  if (route.name !== 'player') void router.push({ name: 'player' })
}
</script>

<template>
  <AppDialog
    v-model:open="ui.shortcutsOpen"
    title="Keyboard shortcuts"
    show-title
    width="min(1100px, 100vw - 48px)"
    data-testid="shortcuts-sheet"
    @keydown="onKeyDown"
  >
    <div class="groups">
      <section
        v-for="group in groups"
        :key="group.scope"
        class="group"
        :data-testid="`sheet-group-${group.scope}`"
      >
        <h3 class="section-caps">{{ group.title }}</h3>
        <p class="where">{{ group.where }}</p>
        <dl class="list">
          <div
            v-for="cmd in group.commands"
            :key="cmd.id"
            class="row"
            :title="cmd.description"
            data-testid="sheet-row"
            :data-command="cmd.id"
          >
            <dt class="label">{{ cmd.label }}</dt>
            <dd class="keys">
              <template v-if="cmd.keys.length > 0">
                <kbd v-for="k in cmd.keys" :key="k" class="key" data-testid="sheet-key">{{
                  k
                }}</kbd>
              </template>
              <span v-else class="none">—</span>
            </dd>
          </div>
        </dl>
      </section>
      <section class="group roles">
        <h3 class="section-caps">Lists on each page</h3>
        <ListRolesTable />
      </section>
    </div>
    <template #footer>
      <AppButton variant="text" data-testid="sheet-change" @click="changeShortcuts">
        Change shortcuts…
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
/* No horizontal scrolling at any size: two columns where there's room, else one; nothing in a
   group may force its width (min-width: 0 all the way down). */
.groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr));
  align-items: start;
  gap: var(--space-5) var(--space-8);
  padding-bottom: var(--space-2);
}

.group {
  min-width: 0;
}

.group .section-caps {
  margin: 0;
}

.roles {
  grid-column: 1 / -1;
}

.roles .section-caps {
  margin-bottom: var(--space-1);
}

.where {
  margin: 2px 0 var(--space-2);
  color: var(--text-4);
  font-size: var(--text-xs);
}

.list {
  min-width: 0;
  margin: 0;
}

/* The label takes what's left and wraps; the keys never shrink and stay right-aligned, moving
   under the label (still right-aligned) when they don't fit beside it. */
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px var(--space-3);
  min-height: 27px;
  padding: 2px 0;
  border-bottom: 1px solid var(--divider);
}

.label {
  flex: 1 1 12ch;
  min-width: 0;
  color: var(--text-2);
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
}

.keys {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  margin: 0 0 0 auto;
  white-space: nowrap;
}

.key {
  flex-shrink: 0;
  min-width: 22px;
  padding: 1px 6px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--field);
  color: var(--text-1);
  font-family: inherit;
  font-size: var(--text-xs);
  text-align: center;
}

.none {
  color: var(--text-4);
  font-size: var(--text-sm);
}
</style>
