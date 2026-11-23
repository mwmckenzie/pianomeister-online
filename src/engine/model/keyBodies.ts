import { constrainKeyboard } from '@/core/settings/constrainKeyboard'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import type { KeyBody } from './KeyBody'
import { keyLayout } from './keyLayout'
import { KEYBOARD } from './KEYBOARD'

/**
 * How far a black key's body reaches below the white keys' bottom. Black bodies run from their
 * raised top all the way down past the white keys, so a pressed neighbour never uncovers a
 * black key's bottom (milestone 9.2 C); the margin keeps the two bottoms from being coplanar.
 */
export const BLACK_DEPTH_MARGIN = 0.02

/**
 * The 88 key bodies for the keyboard settings. Lanes come from keyLayout() and never move:
 * the gap insets white keys within their lanes (black keys keep their lane width, as nothing
 * touches them at their height), so every key stays centred under its notes. Black bodies are
 * deeper than white ones (see BLACK_DEPTH_MARGIN); their top and press pivot don't change.
 */
export function keyBodies(settings: PlayerSettings['keyboard']): KeyBody[] {
  // The geometry enforces the cross-setting limits itself, whatever it is given.
  const keyboard = constrainKeyboard(settings)
  return keyLayout().map((lane) => {
    const centerX = lane.x + lane.width / 2
    if (lane.isBlack) {
      return {
        midi: lane.midi,
        isBlack: true,
        centerX,
        width: lane.width,
        length: KEYBOARD.whiteLength * keyboard.blackLengthRatio,
        top: keyboard.blackHeight,
        thickness: keyboard.blackHeight + keyboard.thickness + BLACK_DEPTH_MARGIN,
        pressDepth: keyboard.pressDepthBlack,
        pivotOffset: keyboard.pivotOffsetBlack,
      }
    }
    return {
      midi: lane.midi,
      isBlack: false,
      centerX,
      width: Math.max(0.05, lane.width - keyboard.gap),
      length: KEYBOARD.whiteLength,
      top: 0,
      thickness: keyboard.thickness,
      pressDepth: keyboard.pressDepthWhite,
      pivotOffset: keyboard.pivotOffsetWhite,
    }
  })
}
