import { readFileSync } from 'node:fs'

export type FixtureName =
  | 'minuet-in-g.mid'
  | 'canon-in-d.mid'
  | 'invention-1.mid'
  | 'pedal-demo.mid'
  | 'meter-demo.mid'

/** The real songs are bundled library songs; synthetic test files live in test-fixtures/. */
const FOLDERS: Record<FixtureName, string> = {
  'minuet-in-g.mid': 'public/songs',
  'canon-in-d.mid': 'public/songs',
  'invention-1.mid': 'public/songs',
  'pedal-demo.mid': 'test-fixtures/midi',
  'meter-demo.mid': 'test-fixtures/midi',
}

export function readFixture(name: FixtureName): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`../../../${FOLDERS[name]}/${name}`, import.meta.url)))
}
