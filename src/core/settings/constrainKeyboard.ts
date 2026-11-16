import type { PlayerSettings } from './PlayerSettings'

type Keyboard = PlayerSettings['keyboard']

/** A fully pressed black key's top stays at least this far above the white key tops (≈2 mm). */
export const BLACK_PRESS_CLEARANCE = 0.08

/**
 * Applies the limits that depend on other keyboard settings (brief decision 44):
 * - the black key height is at most the key thickness, so a raised black key's body still
 *   reaches down to the white keys instead of floating above them;
 * - a black key presses at most blackHeight − 0.08, so its top never sinks to the white tops;
 * - a white key presses at most its thickness, so its front never drops below the keyboard's
 *   bottom.
 * Returns the same object when nothing needs clamping.
 */
export function constrainKeyboard(keyboard: Keyboard): Keyboard {
  const blackHeight = Math.min(keyboard.blackHeight, keyboard.thickness)
  const pressDepthBlack = Math.min(
    keyboard.pressDepthBlack,
    Math.max(0, withoutFloatNoise(blackHeight - BLACK_PRESS_CLEARANCE)),
  )
  const pressDepthWhite = Math.min(keyboard.pressDepthWhite, keyboard.thickness)
  if (
    blackHeight === keyboard.blackHeight &&
    pressDepthBlack === keyboard.pressDepthBlack &&
    pressDepthWhite === keyboard.pressDepthWhite
  ) {
    return keyboard
  }
  return { ...keyboard, blackHeight, pressDepthBlack, pressDepthWhite }
}

/** 0.25 − 0.08 is 0.16999…; a slider with step 0.01 would then snap down to 0.16. */
function withoutFloatNoise(value: number): number {
  return Math.round(value * 1e9) / 1e9
}
