<script setup lang="ts">
import { ref } from 'vue'

import AppPopover from '../components/AppPopover.vue'
import ProfileBadge from '../components/ProfileBadge.vue'
import { useProfileStore } from '../stores/profileStore'

/**
 * The fifth item of the HUD's app menu, shown with two or more profiles (brief decision 66):
 * the active profile's initial in its colour, dim at rest like the other icons, opening a
 * compact switcher. No shortcut.
 */
const profiles = useProfileStore()
const open = ref(false)

async function choose(profileId: string): Promise<void> {
  open.value = false
  if (profileId !== profiles.activeId) await profiles.switchTo(profileId)
}
</script>

<template>
  <AppPopover v-model:open="open" side="right" align="end" label="Switch profile">
    <template #trigger>
      <button
        type="button"
        class="profile-menu"
        :aria-label="`Profile: ${profiles.active.name}. Switch profile`"
        data-testid="menu-profile"
      >
        <span class="icon"
          ><ProfileBadge :name="profiles.active.name" :color="profiles.active.color" :size="20"
        /></span>
        <span class="name" aria-hidden="true">{{ profiles.active.name }}</span>
      </button>
    </template>
    <p class="section-caps heading">Profile</p>
    <ul class="list" role="list">
      <li v-for="profile in profiles.profiles" :key="profile.id">
        <button
          type="button"
          class="choice"
          :class="{ current: profile.id === profiles.activeId }"
          :aria-current="profile.id === profiles.activeId ? 'true' : undefined"
          :data-testid="`switch-profile-${profile.name}`"
          @click="choose(profile.id)"
        >
          <ProfileBadge :name="profile.name" :color="profile.color" :size="20" />
          <span class="choice-name">{{ profile.name }}</span>
        </button>
      </li>
    </ul>
  </AppPopover>
</template>

<style scoped>
.profile-menu {
  display: flex;
  align-items: center;
  gap: 10px;
  /* Like the other menu items (36 px from milestone 8). */
  height: 36px;
  padding: 0 8px 0 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  opacity: 0.55;
  filter: var(--icon-shadow-hud);
  transition: opacity var(--dur-fast);
}

.icon {
  display: grid;
  place-items: center;
  width: 24px;
}

.name {
  color: var(--text-1);
  font-size: var(--text-sm);
  white-space: nowrap;
  text-shadow: var(--text-shadow-hud);
  opacity: 0;
  transition: opacity var(--dur-fast);
}

.profile-menu:hover,
.profile-menu:focus-visible,
.profile-menu[data-state='open'] {
  opacity: 1;
}

.profile-menu:hover .name,
.profile-menu:focus-visible .name {
  opacity: 1;
}

.profile-menu:focus-visible {
  box-shadow: none;
  outline: 1px solid rgb(var(--primary-rgb) / 70%);
  outline-offset: 2px;
}

.heading {
  margin-bottom: var(--space-2);
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.choice {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.choice:hover {
  background: rgb(255 255 255 / 6%);
  color: var(--text-1);
}

.choice.current {
  background: rgb(var(--primary-rgb) / 14%);
  color: var(--text-1);
}
</style>
