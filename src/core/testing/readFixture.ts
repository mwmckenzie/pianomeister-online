import { readFileSync } from 'node:fs'

export type FixtureName = 'minuet-in-g.mid' | 'canon-in-d.mid' | 'invention-1.mid'

export function readFixture(name: FixtureName): Uint8Array {
  return new Uint8Array(
    readFileSync(new URL(`../../../test-fixtures/midi/${name}`, import.meta.url)),
  )
}
