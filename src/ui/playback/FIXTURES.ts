import canonUrl from '../../../test-fixtures/midi/canon-in-d.mid?url'
import inventionUrl from '../../../test-fixtures/midi/invention-1.mid?url'
import minuetUrl from '../../../test-fixtures/midi/minuet-in-g.mid?url'
import pedalDemoUrl from '../../../test-fixtures/midi/pedal-demo.mid?url'

/** Bundled test songs until the library (milestone 4). Titles here, since two files only say "Piano". */
export const FIXTURES = [
  { fileName: 'minuet-in-g.mid', title: 'Minuet in G', url: minuetUrl },
  { fileName: 'canon-in-d.mid', title: 'Canon in D', url: canonUrl },
  { fileName: 'invention-1.mid', title: 'Invention No. 1', url: inventionUrl },
  { fileName: 'pedal-demo.mid', title: 'Pedal demo (synthetic)', url: pedalDemoUrl },
] as const
