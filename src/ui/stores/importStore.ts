import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import type { ProfileChoice } from '@/core/library/ProfileChoice'
import type { ImportReport } from '@/data/ImportReport'
import type { PreparedImport } from '@/data/Library'

import { useLibraryStore } from './libraryStore'

interface Pending {
  readonly prepared: PreparedImport
  /** Which collision the dialog shows. */
  readonly step: number
  readonly choices: ReadonlyMap<string, ProfileChoice>
  readonly finish: (choices: ReadonlyMap<string, ProfileChoice> | null) => void
}

/**
 * A backup import in progress (brief decision 75). The backup is read first without writing;
 * if profiles collide, the collision dialog (in App.vue) asks about each one, step by step.
 * Cancel at any step writes nothing.
 */
export const useImportStore = defineStore('import', () => {
  const library = useLibraryStore()
  const pending = shallowRef<Pending | null>(null)

  const collision = computed(() => {
    const p = pending.value
    return p === null ? null : (p.prepared.collisions[p.step] ?? null)
  })

  function choiceFor(profileId: string): ProfileChoice {
    const p = pending.value
    const fallback = p?.prepared.collisions.find((c) => c.incoming.profile.id === profileId)
    return p?.choices.get(profileId) ?? fallback?.defaultChoice ?? 'merge'
  }

  function choose(choice: ProfileChoice): void {
    const p = pending.value
    const c = collision.value
    if (p === null || c === null) return
    pending.value = { ...p, choices: new Map(p.choices).set(c.incoming.profile.id, choice) }
  }

  /** Confirms the current step: on to the next collision, or import after the last. */
  function confirm(): void {
    const p = pending.value
    const c = collision.value
    if (p === null || c === null) return
    const choices = new Map(p.choices).set(c.incoming.profile.id, choiceFor(c.incoming.profile.id))
    if (p.step + 1 < p.prepared.collisions.length) {
      pending.value = { ...p, step: p.step + 1, choices }
    } else {
      pending.value = null
      p.finish(choices)
    }
  }

  function cancel(): void {
    const p = pending.value
    pending.value = null
    p?.finish(null)
  }

  /** Imports a backup, asking about colliding profiles first. Null when cancelled. */
  async function run(bytes: Uint8Array): Promise<ImportReport | null> {
    const prepared = await library.prepareImport(bytes)
    let choices: ReadonlyMap<string, ProfileChoice> = new Map()
    if (prepared.collisions.length > 0) {
      const chosen = await new Promise<ReadonlyMap<string, ProfileChoice> | null>((finish) => {
        pending.value = { prepared, step: 0, choices: new Map(), finish }
      })
      if (chosen === null) return null
      choices = chosen
    }
    return library.applyImport(prepared, choices)
  }

  return { pending, collision, choiceFor, choose, confirm, cancel, run }
})
