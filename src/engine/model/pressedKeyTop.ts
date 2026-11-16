import type { KeyBody } from './KeyBody'
import { keyPressAngle } from './keyPress'

/**
 * Where a key's top edges are at a press progress (0–1): the front and back top edges' heights,
 * and how far the back top edge moved in z (negative = away from the player, under the
 * highway; positive would open a gap at the play line). The keyboard renders keys with
 * exactly this pose (pivot `pivotOffset` behind the back edge, at the key top's height).
 */
export function pressedKeyTop(
  body: KeyBody,
  progress: number,
): { readonly frontY: number; readonly backY: number; readonly backShiftZ: number } {
  const angle = keyPressAngle(progress, body.pressDepth, body.length, body.pivotOffset)
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  // A top point at distance d in front of the pivot ends up d·sin lower and d·(1−cos) farther back.
  const back = body.pivotOffset
  const front = body.pivotOffset + body.length
  return {
    frontY: body.top - front * sin,
    backY: body.top - back * sin,
    backShiftZ: -back * (1 - cos),
  }
}
