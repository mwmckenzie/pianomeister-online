import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { DEFAULT_PROFILE } from '@/core/profiles/DEFAULT_PROFILE'
import type { Profile } from '@/core/profiles/Profile'
import { Profiles } from '@/data/Profiles'

import { appDatabase } from './appDatabase'

/**
 * Local profiles (brief decisions 65–66): the list and the active one. Switching only changes
 * which profile is active; the stores that hold per-profile data follow `activeId`, and the
 * player reacts by stopping and reopening that profile's last song or bookmark.
 */
export const useProfileStore = defineStore('profiles', () => {
  const service = new Profiles(appDatabase())
  const profiles = shallowRef<readonly Profile[]>([DEFAULT_PROFILE])
  const activeId = ref(DEFAULT_PROFILE.id)
  const loaded = ref(false)
  /** Bumped on every switch, so watchers see a switch back to the same id too. */
  const switches = ref(0)

  const active = computed(
    () =>
      profiles.value.find((p) => p.id === activeId.value) ?? profiles.value[0] ?? DEFAULT_PROFILE,
  )

  let loading: Promise<void> | null = null

  /** Loads the list and the active profile once; later calls wait for the same load. */
  function load(): Promise<void> {
    loading ??= (async () => {
      const [list, id] = await Promise.all([service.list(), service.activeId()])
      profiles.value = list
      activeId.value = id
      loaded.value = true
    })()
    return loading
  }

  async function refresh(): Promise<void> {
    profiles.value = await service.list()
    if (!profiles.value.some((p) => p.id === activeId.value)) {
      activeId.value = await service.activeId()
      switches.value++
    }
  }

  async function switchTo(profileId: string): Promise<void> {
    await service.setActive(profileId)
    activeId.value = profileId
    switches.value++
  }

  async function create(name: string, color: string): Promise<Profile> {
    const profile = await service.create(name, color)
    await refresh()
    return profile
  }

  async function update(
    profileId: string,
    changes: Partial<Pick<Profile, 'name' | 'color'>>,
  ): Promise<void> {
    await service.update(profileId, changes)
    await refresh()
  }

  async function remove(profileId: string): Promise<void> {
    await service.delete(profileId)
    await refresh()
  }

  return {
    profiles,
    activeId,
    active,
    loaded,
    switches,
    load,
    refresh,
    switchTo,
    create,
    update,
    remove,
  }
})
