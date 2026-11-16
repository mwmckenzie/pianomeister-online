/** Small app-wide values, e.g. { key: 'lastSongId', value: '<sha256>' }. */
export interface AppStateRow {
  readonly key: string
  readonly value: string
}
