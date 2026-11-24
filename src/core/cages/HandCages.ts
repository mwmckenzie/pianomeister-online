import type { Hand } from '../hands/Hand'
import type { HandCage } from './HandCage'

/** Each hand's cages in bar order; bars without a cage are left out. */
export type HandCages = Readonly<Record<Hand, readonly HandCage[]>>
