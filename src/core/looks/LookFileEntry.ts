/** One look in a `.pmlook.json` file (milestone 9.1, section A). */
export interface LookFileEntry {
  readonly id: string
  readonly name: string
  /** ISO 8601. */
  readonly createdAt: string
  /** Stored-settings shape: `{ section: { field: value } }`. */
  readonly settings: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}
