/** Allowed values of every enum-like string setting; anything else falls back to the default. */
export const SETTING_CHOICES = {
  keyboard: { edgeProfile: ['none', 'chamfer', 'rounded'] },
  notes: { blackLiftMode: ['keys', 'manual'] },
  render: { antialias: ['off', 'msaa', 'fxaa', 'smaa'] },
} as const satisfies Record<string, Record<string, readonly string[]>>
