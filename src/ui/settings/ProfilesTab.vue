<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { PROFILE_COLORS } from '@/core/profiles/PROFILE_COLORS'
import type { Profile } from '@/core/profiles/Profile'
import { formatLastPracticed, lastPracticedPhrase } from '@/core/stats/formatLastPracticed'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'
import type { PracticeTotals } from '@/core/stats/PracticeTotals'
import { THEME_PRESETS } from '@/core/color/THEME_PRESETS'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import ProfileBadge from '../components/ProfileBadge.vue'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useProfileStore } from '../stores/profileStore'
import { useStatsStore } from '../stores/statsStore'
import { useToastStore } from '../stores/toastStore'

/**
 * Settings → Profiles (brief decisions 65–66 and 71): every local profile with its colour,
 * total practice time and last practice; create, rename, recolour, switch and delete (a confirm
 * names what is deleted; the last profile can't be). Below, the active profile's summary.
 */
const profiles = useProfileStore()
const stats = useStatsStore()
const bookmarks = useBookmarkStore()
const library = useLibraryStore()
const toasts = useToastStore()

const totals = shallowRef<ReadonlyMap<string, PracticeTotals>>(new Map())
const bookmarkCounts = shallowRef<ReadonlyMap<string, number>>(new Map())
const editingId = ref<string | null>(null)
const editName = ref('')
const creating = ref(false)
const newName = ref('')
const newColor = ref(PROFILE_COLORS[1] ?? '#7EE0C3')
const deleting = shallowRef<Profile | null>(null)

const colorNames = new Map<string, string>(THEME_PRESETS.map((p) => [p.primary, p.name]))

async function refresh(): Promise<void> {
  await profiles.load()
  const [t, c] = await Promise.all([stats.totalsByProfile(), bookmarks.countByProfile()])
  totals.value = t
  bookmarkCounts.value = c
}

onMounted(() => void refresh())
// The active profile's records change as you practise.
watch(
  () => stats.records,
  () => void refresh(),
)

function totalFor(id: string): PracticeTotals {
  return totals.value.get(id) ?? { plays: 0, playedMs: 0, lastPlayedAt: null }
}

/** "2 h 30 min practiced · last practiced today", or "Not practiced yet". */
function factsLine(id: string): string {
  const t = totalFor(id)
  if (t.playedMs <= 0) return 'Not practiced yet'
  return `${formatPracticeTime(t.playedMs)} practiced · ${lastPracticedPhrase(t.lastPlayedAt, stats.now)}`
}

function startRename(profile: Profile): void {
  editingId.value = profile.id
  editName.value = profile.name
}

async function saveRename(profile: Profile): Promise<void> {
  const name = editName.value.trim()
  editingId.value = null
  if (name !== '' && name !== profile.name) await profiles.update(profile.id, { name })
}

async function recolour(profile: Profile, color: string): Promise<void> {
  if (color !== profile.color) await profiles.update(profile.id, { color })
}

async function create(): Promise<void> {
  const name = newName.value.trim()
  if (name === '') return
  await profiles.create(name, newColor.value)
  creating.value = false
  newName.value = ''
  await refresh()
}

async function switchTo(profile: Profile): Promise<void> {
  await profiles.switchTo(profile.id)
}

const deleteText = computed(() => {
  const p = deleting.value
  if (p === null) return ''
  const count = bookmarkCounts.value.get(p.id) ?? 0
  const time = totalFor(p.id).playedMs
  const marks = `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`
  const history = time > 0 ? `${formatPracticeTime(time)} of practice stats` : 'its practice stats'
  return `This deletes ${p.name}'s ${marks} and ${history}, and its own hands for songs. This can't be undone.`
})

async function confirmDelete(): Promise<void> {
  const p = deleting.value
  deleting.value = null
  if (p === null) return
  try {
    await profiles.remove(p.id)
    toasts.show(`Deleted profile ${p.name}`)
  } catch (e) {
    toasts.show(e instanceof Error ? e.message : String(e), 'error')
  }
  await refresh()
}

const summary = computed(() => stats.summary)
const mostPracticed = computed(() => {
  const id = summary.value.mostPracticedSongId
  if (id === null) return '—'
  return library.entries.find((e) => e.songId === id)?.title ?? 'A removed song'
})
const summaryItems = computed(() => [
  { label: 'Sessions', value: String(summary.value.sessions), testid: 'summary-sessions' },
  {
    label: 'Songs practiced',
    value: String(summary.value.songsPracticed),
    testid: 'summary-songs',
  },
  {
    label: 'Total practice',
    value: formatPracticeTime(summary.value.playedMs),
    testid: 'summary-time',
  },
  { label: 'Most practiced', value: mostPracticed.value, testid: 'summary-most' },
  {
    label: 'Last practice',
    value: formatLastPracticed(summary.value.lastPlayedAt, stats.now),
    testid: 'summary-last',
  },
  {
    label: 'Average session',
    value: formatPracticeTime(summary.value.averageSessionMs),
    testid: 'summary-average',
  },
])

onMounted(() => {
  if (!library.loaded) void library.refresh()
})
</script>

<template>
  <section class="block" aria-label="Profiles">
    <h3 class="section-caps">Profiles</h3>
    <p class="text">
      Each profile has its own bookmarks, practice stats and hands. Settings are shared.
    </p>
    <ul class="profiles" role="list">
      <li
        v-for="profile in profiles.profiles"
        :key="profile.id"
        class="profile"
        :class="{ active: profile.id === profiles.activeId }"
        data-testid="profile-row"
      >
        <ProfileBadge :name="profile.name" :color="profile.color" :size="28" />
        <div class="who">
          <form
            v-if="editingId === profile.id"
            class="rename"
            @submit.prevent="saveRename(profile)"
          >
            <input
              v-model="editName"
              class="form-control"
              maxlength="40"
              aria-label="Profile name"
              data-testid="profile-rename-input"
              @blur="saveRename(profile)"
              @keydown.esc.stop="editingId = null"
            />
          </form>
          <span v-else class="name" data-testid="profile-name">{{ profile.name }}</span>
          <span class="facts" data-testid="profile-facts">{{ factsLine(profile.id) }}</span>
          <div class="colors" role="radiogroup" :aria-label="`${profile.name}'s colour`">
            <button
              v-for="color in PROFILE_COLORS"
              :key="color"
              type="button"
              class="swatch"
              role="radio"
              :aria-checked="profile.color === color"
              :aria-label="colorNames.get(color) ?? color"
              :style="{ background: color }"
              :data-testid="`profile-color-${colorNames.get(color)}`"
              @click="recolour(profile, color)"
            />
          </div>
        </div>
        <div class="actions">
          <span v-if="profile.id === profiles.activeId" class="badge" data-testid="profile-active"
            >Active</span
          >
          <AppButton
            v-else
            size="sm"
            variant="primary"
            data-testid="profile-switch"
            @click="switchTo(profile)"
          >
            Switch
          </AppButton>
          <AppButton size="sm" data-testid="profile-rename" @click="startRename(profile)">
            Rename
          </AppButton>
          <AppButton
            size="sm"
            danger
            :disabled="profiles.profiles.length <= 1"
            :title="
              profiles.profiles.length <= 1 ? 'The last profile can\'t be deleted' : undefined
            "
            data-testid="profile-delete"
            @click="deleting = profile"
          >
            Delete…
          </AppButton>
        </div>
      </li>
    </ul>

    <form v-if="creating" class="create" data-testid="profile-create-form" @submit.prevent="create">
      <input
        v-model="newName"
        class="form-control"
        maxlength="40"
        placeholder="Name"
        aria-label="New profile name"
        data-testid="profile-new-name"
      />
      <div class="colors" role="radiogroup" aria-label="New profile colour">
        <button
          v-for="color in PROFILE_COLORS"
          :key="color"
          type="button"
          class="swatch"
          role="radio"
          :aria-checked="newColor === color"
          :aria-label="colorNames.get(color) ?? color"
          :style="{ background: color }"
          @click="newColor = color"
        />
      </div>
      <AppButton
        type="submit"
        variant="primary"
        :disabled="newName.trim() === ''"
        data-testid="profile-create"
      >
        Create
      </AppButton>
      <AppButton @click="creating = false">Cancel</AppButton>
    </form>
    <AppButton v-else icon="plus" data-testid="profile-new" @click="creating = true">
      New profile
    </AppButton>
  </section>

  <section class="block" aria-label="Summary">
    <h3 class="section-caps">{{ profiles.active.name }} · summary</h3>
    <dl class="summary">
      <div v-for="item in summaryItems" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd :data-testid="item.testid">{{ item.value }}</dd>
      </div>
    </dl>
    <RouterLink :to="{ name: 'stats' }" class="all-stats" data-testid="profiles-see-all-stats"
      >See all stats</RouterLink
    >
  </section>

  <AppDialog
    v-if="deleting"
    :open="deleting !== null"
    :title="`Delete ${deleting.name}?`"
    show-title
    width="460px"
    data-testid="profile-delete-dialog"
    @update:open="(value: boolean) => !value && (deleting = null)"
  >
    <p class="dialog-text" data-testid="profile-delete-text">{{ deleteText }}</p>
    <template #footer>
      <AppButton @click="deleting = null">Cancel</AppButton>
      <AppButton
        variant="primary"
        danger
        data-testid="profile-delete-confirm"
        @click="confirmDelete"
      >
        Delete profile
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.text {
  margin: 0;
  color: var(--text-3);
  font-size: var(--text-sm);
}

.profiles {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.profile.active {
  border-color: rgb(var(--primary-rgb) / 45%);
}

.who {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.name {
  font-weight: var(--weight-medium);
}

.facts {
  color: var(--text-3);
  font-size: var(--text-sm);
}

.colors {
  display: flex;
  gap: 6px;
}

.swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
}

.swatch[aria-checked='true'] {
  border-color: var(--text-strong);
}

.swatch:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgb(var(--primary-rgb) / 18%);
  color: var(--primary);
  font-size: var(--text-xs);
  font-weight: 600;
}

.rename input {
  max-width: 260px;
}

.create {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.create input {
  max-width: 220px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4) var(--space-6);
  margin: 0;
}

.summary dt {
  color: var(--text-3);
  font-size: var(--text-xs);
}

.summary dd {
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 300;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.all-stats {
  display: inline-block;
  margin-top: var(--space-3);
  color: var(--primary);
  font-size: var(--text-sm);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
