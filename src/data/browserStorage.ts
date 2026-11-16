import type { StorageStatus } from './StorageStatus'

/**
 * navigator.storage wrappers, feature-detected. Persistent storage protects uploads from
 * eviction under storage pressure; Safari additionally clears site data after 7 days without
 * a visit unless the site runs as a home-screen app (brief decision 33).
 */
export const browserStorage = {
  async requestPersistence(): Promise<boolean | null> {
    const storage = globalThis.navigator?.storage
    if (storage?.persist === undefined) return null
    try {
      return (await storage.persisted()) || (await storage.persist())
    } catch {
      return null
    }
  },

  async status(): Promise<StorageStatus> {
    const storage = globalThis.navigator?.storage
    let persisted: boolean | null = null
    let usage: number | null = null
    let quota: number | null = null
    try {
      if (storage?.persisted !== undefined) persisted = await storage.persisted()
      if (storage?.estimate !== undefined) {
        const estimate = await storage.estimate()
        usage = estimate.usage ?? null
        quota = estimate.quota ?? null
      }
    } catch {
      // Unavailable (e.g. some private modes): report unknown.
    }
    return { persisted, usage, quota }
  },
}
