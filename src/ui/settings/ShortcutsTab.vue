<script setup lang="ts">
import { computed } from 'vue'

import { COMMANDS } from '@/core/commands/COMMANDS'

import ListRolesTable from '../shortcuts/ListRolesTable.vue'
import { SHORTCUT_GROUPS } from '../shortcuts/SHORTCUT_GROUPS'
import { useUiStateStore } from '../stores/uiStateStore'
import ShortcutRow from './ShortcutRow.vue'

/**
 * Settings → Shortcuts (brief decisions 84–89): every command by scope, each with its keys, a
 * way to record, add or remove one, and a reset icon. Reset all and the changed count are in
 * the window footer.
 */
const ui = useUiStateStore()

const groups = computed(() =>
  SHORTCUT_GROUPS.map((group) => ({
    ...group,
    commands: COMMANDS.filter((c) => c.scope === group.scope),
  })),
)
</script>

<template>
  <p class="hint">
    Click a key to change it, × to remove it, + to add a second one. Letters and symbols work by the
    character they type, so they follow your keyboard layout; Shift+letter isn't a separate
    shortcut, but Ctrl and Alt combos are. Arrow keys on a focused slider or the timeline, and Enter
    in a text field, stay with that control.
    <button
      type="button"
      class="link"
      data-testid="open-shortcuts-sheet"
      @click="ui.shortcutsOpen = true"
    >
      Keyboard shortcuts
    </button>
  </p>
  <section
    v-for="group in groups"
    :key="group.scope"
    class="group"
    :data-testid="`shortcuts-${group.scope}`"
  >
    <h3 class="section-caps">{{ group.title }}</h3>
    <p class="where">{{ group.where }}</p>
    <p v-if="group.scope === 'lists'" class="where">
      List keys work wherever the focus is on these pages, except while typing (a search field still
      passes on keys that type nothing), on a focused slider or other control that uses the key, or
      while another dialog is open. Which list each key moves: see "Lists on each page" below.
    </p>
    <ShortcutRow v-for="command in group.commands" :key="command.id" :command="command" />
  </section>
  <section class="group" data-testid="shortcuts-list-roles">
    <h3 class="section-caps">Lists on each page</h3>
    <ListRolesTable />
  </section>
</template>

<style scoped>
.hint {
  margin: 0 0 var(--space-4);
  color: var(--text-3);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.group {
  min-width: 0;
  margin-bottom: var(--space-6);
}

.group .section-caps {
  margin: 0;
}

.where {
  margin: 0 0 var(--space-1);
  color: var(--text-4);
  font-size: var(--text-xs);
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
</style>
