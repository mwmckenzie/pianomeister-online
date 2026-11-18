import { PianoMeisterDb } from '@/data/PianoMeisterDb'

let db: PianoMeisterDb | null = null

/** The app's one database, shared by the stores (created on first use). */
export function appDatabase(): PianoMeisterDb {
  db ??= new PianoMeisterDb()
  return db
}
