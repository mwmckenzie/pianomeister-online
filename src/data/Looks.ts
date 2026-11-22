import type { Look } from '@/core/looks/Look'

import type { PianoMeisterDb } from './PianoMeisterDb'

/**
 * Saved looks (brief decision 121), device-wide in the database: every write goes through
 * here. Built-in looks ship with the app and are never stored.
 */
export class Looks {
  constructor(private readonly db: PianoMeisterDb) {}

  /** In the order they were saved. */
  async list(): Promise<Look[]> {
    return this.db.looks.orderBy('createdAt').toArray()
  }

  async put(look: Look): Promise<void> {
    await this.db.looks.put({ ...look, builtIn: false })
  }

  async delete(id: string): Promise<void> {
    await this.db.looks.delete(id)
  }

  /**
   * Moves looks stored in localStorage before milestone 9.1 into the database. Ones already
   * there (an earlier, interrupted move) are left as they are, so it can safely run again.
   */
  async adopt(looks: readonly Look[]): Promise<void> {
    await this.db.transaction('rw', this.db.looks, async () => {
      const have = new Set(await this.db.looks.toCollection().primaryKeys())
      await this.db.looks.bulkAdd(
        looks.filter((look) => !have.has(look.id)).map((look) => ({ ...look, builtIn: false })),
      )
    })
  }
}
