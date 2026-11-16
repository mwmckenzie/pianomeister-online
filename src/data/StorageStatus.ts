/** Browser storage state for the Library's status line; null where the browser can't tell. */
export interface StorageStatus {
  readonly persisted: boolean | null
  /** Bytes. */
  readonly usage: number | null
  readonly quota: number | null
}
