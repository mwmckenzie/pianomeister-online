import type { VoiceRole } from '@/core/hands/HandSettings'

/** The role picker's options. */
export const VOICE_ROLES = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'split', label: 'Split' },
  { value: 'hidden', label: 'Hidden' },
] as const satisfies readonly { readonly value: VoiceRole; readonly label: string }[]
