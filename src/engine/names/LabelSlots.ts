import type { PlayerSettings } from '@/core/settings/PlayerSettings'

/**
 * A layer's label stack slots, per "Label repeated notes" choice: unlabelled repeats don't take
 * slots, so each choice has its own.
 */
export type LabelSlots = Readonly<Record<PlayerSettings['names']['repeats'], Uint8Array>>
