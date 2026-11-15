import type { Note } from '../song/Note'
import type { Hand } from './Hand'

export interface HandNote extends Note {
  readonly hand: Hand
}
