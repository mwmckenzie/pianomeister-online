import { constrainKeyboard } from '@/core/settings/constrainKeyboard'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import type { KeyBody } from './KeyBody'
import { keyLayout } from './keyLayout'
import { KEYBOARD } from './KEYBOARD'

/**
 * The 88 key bodies for the keyboard settings. Lanes come from keyLayout() and never move:
 * the gap insets white keys within their lanes (black keys keep their lane width, as nothing
 * touches them at their height), so every key stays centred under its notes.
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
        thickness: keyboard.thickness,
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
