<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { PlaylistRepeat } from '@/core/playlists/PlaylistRepeat'

import AppIcon from '../components/AppIcon.vue'
import IconButton from '../components/IconButton.vue'
import { formatTime } from '../format/formatTime'
import { useListeningStore } from '../stores/listeningStore'
import { useSettingsStore } from '../stores/settingsStore'
import BarBeatCounter from './BarBeatCounter.vue'
import HudMenuButton from './HudMenuButton.vue'

/**
 * Listening mode's HUD (milestone 9.5 C, board QGListen), replacing the player's while a playlist
 * plays. Show: the playlist and position, the song, bar : beat (per song), "Up next", bpm, tempo,
 * time, the song transport, shuffle and repeat. Minimal: the title and composer only. Hidden:
 * nothing (a pure visualizer). In Minimal and Hidden a small transport sits bottom right; the
 * menu column is always there; both follow idle-hide. A new song is announced in the middle.
 */
defineProps<{
  /** Idle-hide: the menu and the compact transport fade with the player's controls. */
  readonly idle: boolean
  readonly reducedMotion: boolean
  readonly sidebarOpen: boolean
}>()
const emit = defineEmits<{
  leave: []
  next: []
  previous: []
  togglePlay: []
  toggleMute: []
  playAgain: []
  openPlaylists: []
  togglePlayfield: []
  openSettings: []
  setShuffle: [on: boolean]
  setRepeat: [repeat: PlaylistRepeat]
}>()

const listening = useListeningStore()
const settings = useSettingsStore()
const mode = computed(() => settings.settings.appearance.listeningHud)
const clock = computed(() => listening.clock)
const playing = computed(() => clock.value?.playing ?? false)
const key = (id: Parameters<typeof settings.shortcutLabel>[0]) => settings.shortcutLabel(id)

/** "Up next · Für Elise · Beethoven": the composer's surname only (the board). */
function surname(composer: string): string {
  const clean = composer.replace(/\(.*?\)/g, '').trim()
  return clean.split(/\s+/).pop() ?? clean
}
const upNext = computed(() => {
  const next = listening.upNext
  if (next === null) return ''
  return next.composer === '' ? next.title : `${next.title} · ${surname(next.composer)}`
})
const tempoText = computed(() => `${listening.tempoPercent}%`)
const time = computed(() => {
  const c = clock.value
  return c === null ? '' : `${formatTime(c.elapsedSec)} / ${formatTime(c.durationSec)}`
})
const progress = computed(() => {
  const c = clock.value
  return c === null || c.durationSec <= 0 ? 0 : Math.min(1, c.elapsedSec / c.durationSec)
})
const REPEAT_LABEL: Record<PlaylistRepeat, string> = {
  playlist: 'repeat playlist',
  one: 'repeat one song',
  off: 'repeat off',
}
const NEXT_REPEAT: Record<PlaylistRepeat, PlaylistRepeat> = {
  playlist: 'one',
  one: 'off',
  off: 'playlist',
}

// The announcement: "Now playing · N of M", the title and composer for about 3 s (not in Hidden).
const announcing = ref(false)
let announceTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => listening.announced,
  () => {
    if (mode.value === 'hidden') return
    announcing.value = true
    clearTimeout(announceTimer)
    announceTimer = setTimeout(() => (announcing.value = false), 3000)
  },
)
onBeforeUnmount(() => clearTimeout(announceTimer))
</script>

<template>
  <div class="listening" :class="[mode, { idle }]" data-testid="listening-hud" :data-mode="mode">
    <div v-if="mode !== 'hidden'" class="progress" aria-hidden="true">
      <div class="bar" :style="{ width: `${progress * 100}%` }" />
      <div class="knob" :style="{ left: `${progress * 100}%` }" />
    </div>

    <div v-if="mode !== 'hidden'" class="side left hud-text">
      <p v-if="mode === 'show'" class="where" data-testid="listening-where">
        <AppIcon name="headphones" :size="14" />
        <span
          >{{ listening.playlistName }} · song {{ listening.position }} of
          {{ listening.total }}</span
        >
      </p>
      <p class="title" data-testid="listening-title">{{ listening.current?.title ?? '' }}</p>
      <p class="composer" data-testid="listening-composer">
        {{ listening.current?.composer ?? '' }}
      </p>
      <template v-if="mode === 'show' && clock !== null">
        <BarBeatCounter
          :bar="clock.bar"
          :beat="clock.beat"
          :pre-roll="false"
          :dot-beat="clock.beat"
          :dot-beats="clock.beats"
          :bar-digits="3"
          :beat-digits="1"
        />
        <p v-if="upNext !== ''" class="up-next" data-testid="listening-up-next">
          Up next · {{ upNext }}
        </p>
      </template>
    </div>

    <div v-if="mode === 'show'" class="side right hud-text">
      <p class="bpm" data-testid="listening-bpm">{{ Math.round(clock?.bpm ?? 0) }} bpm</p>
      <p class="tempo-line">
        <span :class="{ changed: listening.tempoPercent !== 100 }" data-testid="listening-tempo">{{
          tempoText
        }}</span>
        · full song
      </p>
      <p class="time" data-testid="listening-time">{{ time }}</p>
      <div class="transport">
        <IconButton
          icon="prevBar"
          label="Previous song"
          :shortcut="key('previousSong')"
          data-testid="listening-previous"
          @click="emit('previous')"
        />
        <IconButton
          :icon="playing ? 'pause' : 'play'"
          :label="playing ? 'Pause' : 'Play'"
          :shortcut="key('playPause')"
          size="lg"
          variant="outline"
          data-testid="listening-play"
          @click="emit('togglePlay')"
        />
        <IconButton
          icon="nextBar"
          label="Next song"
          :shortcut="key('nextSong')"
          data-testid="listening-next"
          @click="emit('next')"
        />
      </div>
      <button
        type="button"
        class="state"
        :class="{ on: listening.shuffle }"
        :aria-pressed="listening.shuffle"
        data-testid="listening-shuffle"
        @click="emit('setShuffle', !listening.shuffle)"
      >
        shuffle {{ listening.shuffle ? 'on' : 'off' }} <AppIcon name="shuffle" :size="18" />
      </button>
      <button
        type="button"
        class="state"
        :class="{ on: listening.repeat !== 'off' }"
        data-testid="listening-repeat"
        @click="emit('setRepeat', NEXT_REPEAT[listening.repeat])"
      >
        {{ REPEAT_LABEL[listening.repeat] }}
        <AppIcon :name="listening.repeat === 'one' ? 'repeatOne' : 'repeat'" :size="18" />
      </button>
    </div>

    <div
      v-if="mode !== 'show'"
      class="compact"
      :class="{ hidden: idle }"
      data-testid="listening-compact"
    >
      <IconButton
        icon="prevBar"
        label="Previous song"
        :shortcut="key('previousSong')"
        @click="emit('previous')"
      />
      <IconButton
        :icon="playing ? 'pause' : 'play'"
        :label="playing ? 'Pause' : 'Play'"
        :shortcut="key('playPause')"
        size="lg"
        variant="outline"
        @click="emit('togglePlay')"
      />
      <IconButton
        icon="nextBar"
        label="Next song"
        :shortcut="key('nextSong')"
        @click="emit('next')"
      />
    </div>

    <nav class="menu" :class="{ hidden: idle }" aria-label="Listening" data-testid="listening-menu">
      <button type="button" class="leave" data-testid="listening-leave" @click="emit('leave')">
        <AppIcon name="headphones" :size="20" />
        <span>Leave listening</span><span class="key">Esc</span>
      </button>
      <button
        type="button"
        class="mute"
        :class="{ muted: listening.muted }"
        :aria-pressed="listening.muted"
        :aria-label="`Mute (${key('toggleMute')})`"
        data-testid="listening-mute"
        @click="emit('toggleMute')"
      >
        <AppIcon :name="listening.muted ? 'mute' : 'volume'" :size="20" />
      </button>
      <HudMenuButton
        icon="playlist"
        label="Playlists"
        shortcut=""
        data-testid="listening-playlists"
        @click="emit('openPlaylists')"
      />
      <HudMenuButton
        icon="sliders"
        label="Playfield panel"
        :shortcut="key('togglePlayfield')"
        :active="sidebarOpen"
        @click="emit('togglePlayfield')"
      />
      <HudMenuButton
        icon="settings"
        label="Settings"
        :shortcut="key('openSettings')"
        @click="emit('openSettings')"
      />
    </nav>

    <Transition :name="reducedMotion ? '' : 'announce'">
      <div
        v-if="announcing && mode !== 'hidden' && listening.current !== null"
        class="announce"
        aria-live="polite"
        data-testid="listening-announce"
      >
        <p class="caption">Now playing · {{ listening.position }} of {{ listening.total }}</p>
        <p class="big">{{ listening.current.title }}</p>
        <p class="by">{{ listening.current.composer }}</p>
      </div>
    </Transition>

    <div v-if="listening.finished" class="finished" data-testid="listening-finished">
      <span>Playlist finished</span> ·
      <button type="button" data-testid="listening-play-again" @click="emit('playAgain')">
        Play again
      </button>
    </div>

    <p class="visually-hidden">
      <span data-testid="transport-state">{{ playing ? 'playing' : 'paused' }}</span>
    </p>
  </div>
</template>

<style scoped>
.listening {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: var(--text-1);
}

.listening > * {
  pointer-events: auto;
}

.progress {
  position: absolute;
  top: 12px;
  left: 28px;
  right: 28px;
  height: 3px;
  border-radius: 2px;
  background: rgb(255 255 255 / 0.12);
  pointer-events: none;
}

.progress .bar {
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
}

.progress .knob {
  position: absolute;
  top: -5px;
  width: 13px;
  height: 13px;
  margin-left: -6.5px;
  border-radius: 50%;
  background: #fff;
}

.side {
  position: absolute;
  top: 40px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.left {
  left: 28px;
  max-width: 45%;
}

.right {
  right: 28px;
  align-items: flex-end;
}

.hud-text p {
  margin: 0;
  text-shadow: var(--text-shadow-hud);
}

.where {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--secondary);
  font-size: 12px;
}

.title {
  font-size: 17px;
  font-weight: 600;
}

.composer {
  color: var(--text-2);
  font-size: 13px;
}

.up-next {
  margin-top: 6px !important;
  color: var(--text-2);
  font-size: 13px;
}

.bpm {
  font-size: 52px;
  font-weight: 200;
  line-height: 1;
}

.tempo-line,
.time {
  color: var(--text-2);
  font-size: 13px;
}

.changed {
  color: var(--primary);
}

.transport,
.compact {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.state {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-3);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  text-shadow: var(--text-shadow-hud);
}

.state.on {
  color: var(--secondary);
}

.compact {
  position: absolute;
  right: 28px;
  bottom: 120px;
  transition: opacity 0.3s;
}

.menu {
  position: absolute;
  left: 28px;
  bottom: 28px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  transition: opacity 0.3s;
}

.hidden {
  opacity: 0;
  pointer-events: none;
}

.leave,
.mute {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
  text-shadow: var(--text-shadow-hud);
}

.leave {
  color: var(--secondary);
}

.leave .key {
  color: var(--text-3);
  font-size: 12px;
}

.mute {
  color: rgb(200 206 220 / 0.75);
}

.mute.muted {
  color: #ff9d7a;
}

.announce {
  position: absolute;
  top: 210px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
}

.announce p {
  margin: 0;
  text-shadow: var(--text-shadow-hud);
}

.caption {
  color: var(--secondary);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.big {
  font-size: 40px;
  font-weight: 300;
}

.by {
  color: var(--text-2);
  font-size: 16px;
}

.announce-enter-active,
.announce-leave-active {
  transition: opacity 0.6s;
}

.announce-enter-from,
.announce-leave-to {
  opacity: 0;
}

.finished {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translateX(-50%);
  color: var(--text-1);
  font-size: 18px;
  text-shadow: var(--text-shadow-hud);
}

.finished button {
  border: 0;
  background: none;
  color: var(--secondary);
  font: inherit;
  cursor: pointer;
}
</style>
