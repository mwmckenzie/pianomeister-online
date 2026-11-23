<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import { greeting } from '@/core/insights/greeting'
import { pickHighlights } from '@/core/insights/pickHighlights'
import { pickSuggestions } from '@/core/insights/pickSuggestions'

import { pageListCommand } from '../input/pageListCommand'
import { usePracticeStore } from '../stores/practiceStore'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useProfileStore } from '../stores/profileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { usePracticeDays } from '../stats/usePracticeDays'
import CalendarCard from '../welcome/CalendarCard.vue'
import ListenCard from '../welcome/ListenCard.vue'
import HighlightRotator from '../welcome/HighlightRotator.vue'
import ProfileChip from '../welcome/ProfileChip.vue'
import ResumeCard from '../welcome/ResumeCard.vue'
import SuggestionChips from '../welcome/SuggestionChips.vue'
import WeekCard from '../welcome/WeekCard.vue'

/**
 * The Welcome screen (docs/design/m7-7/source/QGWelcomeA, m7-7 decisions 5–13), shown over the
 * player's paused scene: the greeting, "Pick up where you left off", this week, the last 12
 * weeks, a rotating highlight and "Maybe next". Enter resumes ("Open the selection").
 */
const profiles = useProfileStore()
const library = useLibraryStore()
const bookmarks = useBookmarkStore()
const settings = useSettingsStore()
const practice = usePracticeStore()
const { stats, weekStart } = usePracticeDays()
const resumeCard = useTemplateRef<InstanceType<typeof ResumeCard>>('resumeCard')

const hello = computed(() => greeting(new Date(stats.now).getHours(), profiles.active.name))
const date = computed(() =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    stats.now,
  ),
)
const songTitle = (songId: string) =>
  library.entries.find((e) => e.songId === songId)?.title ?? 'A removed song'
const highlights = computed(() =>
  pickHighlights({
    records: stats.records,
    bookmarks: bookmarks.bookmarks,
    songTitle,
    now: stats.now,
    weekStart,
    gapMs: stats.gapMs,
  }),
)
const suggestions = computed(() =>
  pickSuggestions({
    records: stats.records,
    bookmarks: bookmarks.bookmarks,
    songs: library.entries,
    now: stats.now,
    // The song loaded behind Welcome is the resume card's: not a suggestion too.
    exceptSongId: practice.songId ?? undefined,
  }),
)

function onKeyDown(event: KeyboardEvent): void {
  if (pageListCommand(event, settings.bindings) !== 'listOpen') return
  event.preventDefault()
  resumeCard.value?.resume()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  void bookmarks.refresh()
  if (!library.loaded) void library.refresh()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div :key="profiles.activeId" class="welcome" data-testid="welcome">
    <section class="greeting">
      <p class="date" data-testid="welcome-date">{{ date }}</p>
      <h1 class="hello" data-testid="greeting">
        {{ hello.text
        }}<template v-if="hello.name"
          >, <span class="name">{{ hello.name }}</span></template
        >
      </h1>
    </section>
    <div class="profile">
      <ProfileChip />
    </div>
    <div class="resume">
      <ResumeCard ref="resumeCard" />
    </div>
    <div class="cards">
      <WeekCard />
      <CalendarCard />
      <ListenCard />
    </div>
    <div class="highlight">
      <HighlightRotator :highlights="highlights" />
    </div>
    <div class="next">
      <SuggestionChips :suggestions="suggestions" :now="stats.now" />
    </div>
  </div>
</template>

<style scoped>
/* Positions and sizes from QGWelcomeA (1280 × 720). */
.welcome {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--text-1);
  pointer-events: none;
}

.welcome > * {
  position: absolute;
  pointer-events: auto;
}

.greeting {
  top: 70px;
  left: 96px;
  text-shadow: 0 1px 10px rgb(0 0 0 / 85%);
}

.date {
  margin: 0;
  color: var(--text-2);
  font-size: 15px;
}

.hello {
  margin: 4px 0 0;
  font-size: 46px;
  font-weight: 300;
  letter-spacing: -0.01em;
}

.name {
  color: var(--secondary);
}

.profile {
  top: 28px;
  right: 32px;
}

.resume {
  top: 200px;
  left: 96px;
}

.cards {
  top: 100px;
  right: 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.highlight {
  right: 360px;
  bottom: 118px;
  left: 96px;
}

.next {
  right: 32px;
  bottom: 48px;
  left: 96px;
}
</style>
