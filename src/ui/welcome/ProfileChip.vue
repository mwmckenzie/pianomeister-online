<script setup lang="ts">
import { inject, ref } from 'vue'

import AppIcon from '../components/AppIcon.vue'
import AppPopover from '../components/AppPopover.vue'
import ProfileBadge from '../components/ProfileBadge.vue'
import { playerActionsKey } from '../player/playerActionsKey'
import { useProfileStore } from '../stores/profileStore'

/**
 * Welcome's profile chip (QGWelcomeA, m7-7 decision 11): the colour badge and name. With two or
 * more profiles it opens the switcher (as the menu's profile item does), otherwise Settings →
 * Profiles.
 */
const profiles = useProfileStore()
const player = inject(playerActionsKey)
const open = ref(false)

async function choose(profileId: string): Promise<void> {
  open.value = false
  if (profileId !== profiles.activeId) await profiles.switchTo(profileId)
}
</script>

<template>
  <AppPopover
    v-if="profiles.profiles.length > 1"
    v-model:open="open"
    side="bottom"
    align="end"
    label="Switch profile"
  >
    <template #trigger>
      <button type="button" class="chip" data-testid="profile-chip">
        <ProfileBadge :name="profiles.active.name" :color="profiles.active.color" :size="28" />
        {{ profiles.active.name }}
        <AppIcon name="chevronDown" :size="12" />
      </button>
    </template>
    <p class="section-caps heading">Profile</p>
    <ul class="list" role="list">
      <li v-for="profile in profiles.profiles" :key="profile.id">
        <button
          type="button"
          class="choice"
          :aria-current="profile.id === profiles.activeId ? 'true' : undefined"
          :data-testid="`chip-switch-${profile.name}`"
          @click="choose(profile.id)"
        >
          <ProfileBadge :name="profile.name" :color="profile.color" :size="20" />
          {{ profile.name }}
        </button>
      </li>
    </ul>
  </AppPopover>
  <button
    v-else
    type="button"
    class="chip"
    data-testid="profile-chip"
    @click="player?.openSettings('profiles')"
  >
    <ProfileBadge :name="profiles.active.name" :color="profiles.active.color" :size="28" />
    {{ profiles.active.name }}
    <AppIcon name="chevronDown" :size="12" />
  </button>
</template>

<style scoped>
.chip {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 14px 0 6px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 999px;
  background: rgb(18 24 44 / 45%);
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.chip:hover {
  border-color: rgb(255 255 255 / 22%);
}

.chip:focus-visible {
  outline: 2px solid var(--text-strong);
  outline-offset: 2px;
}

.heading {
  margin: 0 0 var(--space-2);
}

.list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.choice {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.choice:hover,
.choice[aria-current='true'] {
  background: var(--field);
}
</style>
