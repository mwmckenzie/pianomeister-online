<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed } from 'vue'

import type { ProfileChoice } from '@/core/library/ProfileChoice'
import type { ProfileFacts } from '@/core/library/ProfileFacts'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'
import { lastPracticedPhrase } from '@/core/stats/formatLastPracticed'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import { useImportStore } from '../stores/importStore'
import { useLibraryBackup } from './useLibraryBackup'

/**
 * Asks what to do with a backup profile that has the same id as one on this device (brief
 * decision 75): Merge, Add as a new profile, or Replace. One step per colliding profile;
 * "Cancel import" writes nothing. The wording states exactly what each choice does.
 */
const imports = useImportStore()
const backup = useLibraryBackup()

const collision = computed(() => imports.collision)
const total = computed(() => imports.pending?.prepared.collisions.length ?? 0)
const step = computed(() => (imports.pending?.step ?? 0) + 1)
const choice = computed({
  get: (): ProfileChoice =>
    collision.value === null ? 'merge' : imports.choiceFor(collision.value.incoming.profile.id),
  set: (value: ProfileChoice) => imports.choose(value),
})
const open = computed({
  get: () => collision.value !== null,
  set: (value: boolean) => {
    if (!value) imports.cancel()
  },
})

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const now = Date.now()

function practiced(ms: number): string {
  return ms > 0 ? `${formatPracticeTime(ms)} practiced` : 'no practice time'
}

function describe(facts: ProfileFacts): string {
  return [
    facts.profile.name,
    plural(facts.bookmarks, 'bookmark', 'bookmarks'),
    practiced(facts.playedMs),
    lastPracticedPhrase(facts.lastPlayedAt, now),
  ].join(' · ')
}

const text = computed(() => {
  const c = collision.value
  if (c === null) return null
  const name = c.local.profile.name
  const history = c.local.playedMs > 0 ? formatPracticeTime(c.local.playedMs) : 'none'
  return {
    title: `A profile named "${name}" already exists`,
    local: `On this device: ${describe(c.local)}`,
    incoming: `In the backup: ${describe(c.incoming)}`,
    merge: {
      label: `Merge into "${name}"`,
      result: `Adds the backup's bookmarks and practice history to your existing profile. Nothing on this device is changed or removed. Afterwards "${name}" has ${plural(c.mergedBookmarks, 'bookmark', 'bookmarks')}.`,
    },
    addNew: {
      label: 'Add as a new profile',
      result: `Keeps your profile as it is and adds the backup as a separate profile named "${c.incoming.profile.name} (imported)". You can rename it later.`,
    },
    replace: {
      label: `Replace "${name}"`,
      result: `Deletes this device's "${name}" bookmarks (${c.local.bookmarks}) and practice history (${history}), then uses the backup's version instead. This can't be undone.`,
    },
  }
})

const OPTIONS = ['merge', 'addNew', 'replace'] as const
</script>

<template>
  <AppDialog
    v-if="text"
    v-model:open="open"
    :title="text.title"
    show-title
    width="620px"
    data-testid="profile-collision"
  >
    <div class="body">
      <p v-if="total > 1" class="step" data-testid="collision-step">{{ step }} of {{ total }}</p>
      <p class="intro" data-testid="collision-intro">
        The backup contains a profile that matches one on this device. Choose what to do with it.
      </p>
      <div class="sides">
        <p class="side" data-testid="collision-local">{{ text.local }}</p>
        <p class="side" data-testid="collision-incoming">{{ text.incoming }}</p>
      </div>
      <RadioGroupRoot v-model="choice" class="options" aria-label="What to do with this profile">
        <label
          v-for="option in OPTIONS"
          :key="option"
          class="option"
          :class="{ selected: choice === option }"
          :data-testid="`collision-${option}`"
        >
          <RadioGroupItem :value="option" class="radio">
            <RadioGroupIndicator class="dot" />
          </RadioGroupItem>
          <span class="option-text">
            <span class="option-label">{{ text[option].label }}</span>
            <span class="option-result" :data-testid="`collision-${option}-result`">{{
              text[option].result
            }}</span>
          </span>
        </label>
      </RadioGroupRoot>
      <div v-if="choice === 'replace'" class="warning" data-testid="collision-warning">
        <span>Replacing removes data from this device for good.</span>
        <AppButton
          size="sm"
          :disabled="backup.busy.value"
          data-testid="collision-export"
          @click="backup.exportLibrary()"
        >
          Export current data first
        </AppButton>
      </div>
    </div>
    <footer class="foot">
      <AppButton data-testid="collision-cancel" @click="imports.cancel()">Cancel import</AppButton>
      <AppButton
        variant="primary"
        :danger="choice === 'replace'"
        data-testid="collision-confirm"
        @click="imports.confirm()"
      >
        {{ choice === 'replace' ? 'Replace and import' : 'Import' }}
      </AppButton>
    </footer>
  </AppDialog>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 0 var(--space-6) var(--space-4);
}

.step {
  margin: 0;
  color: var(--text-4);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.intro {
  margin: 0;
  color: var(--text-2);
}

.sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.side {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: var(--text-sm);
  line-height: 1.45;
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.option.selected {
  border-color: rgb(var(--primary-rgb) / 55%);
  background: rgb(var(--primary-rgb) / 8%);
}

.radio {
  display: grid;
  flex: none;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  padding: 0;
  border: 1.5px solid var(--text-3);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.radio[data-state='checked'] {
  border-color: var(--primary);
}

.radio:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
}

.option-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.option-label {
  color: var(--text-1);
  font-weight: 500;
}

.option-result {
  color: var(--text-3);
  font-size: var(--text-sm);
  line-height: 1.45;
}

.warning {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  color: var(--danger);
  font-size: var(--text-sm);
}

.foot {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding: var(--space-4) var(--space-6) var(--space-6);
}

@media (width < 640px) {
  .sides {
    grid-template-columns: 1fr;
  }
}
</style>
