import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
} from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'

import { keyLayout } from './model/keyLayout'
import { KEYBOARD } from './model/KEYBOARD'
import type { KeyState } from './model/KeyState'

/** Gap between neighbouring white keys, as a fraction of a key width. */
const WHITE_GAP = 0.06
const KEY_DEPTH = 0.6
const OVERLAY_LIFT = 0.003

/**
 * 88 keys at true proportions (black keys raised, back edges flush with the white keys), white
 * or black at rest, each with a pitch-colour overlay on its top driven by KeyStates.
 */
export class Keyboard {
  readonly group = new Group()
  private readonly overlays: Mesh<PlaneGeometry, MeshBasicMaterial>[] = []
  private readonly geometries: (BoxGeometry | PlaneGeometry)[] = []
  private readonly materials: (MeshLambertMaterial | MeshBasicMaterial)[] = []

  constructor() {
    const whiteWidth = KEYBOARD.whiteWidth * (1 - WHITE_GAP)
    const whiteBox = new BoxGeometry(whiteWidth, KEY_DEPTH, KEYBOARD.whiteLength)
    const blackBox = new BoxGeometry(KEYBOARD.blackWidth, KEY_DEPTH, KEYBOARD.blackLength)
    const whiteTop = new PlaneGeometry(whiteWidth, KEYBOARD.whiteLength)
    const blackTop = new PlaneGeometry(KEYBOARD.blackWidth, KEYBOARD.blackLength)
    whiteTop.rotateX(-Math.PI / 2)
    blackTop.rotateX(-Math.PI / 2)
    const whiteMaterial = new MeshLambertMaterial({ color: '#E9E9E4' })
    const blackMaterial = new MeshLambertMaterial({ color: '#141416' })
    this.geometries.push(whiteBox, blackBox, whiteTop, blackTop)
    this.materials.push(whiteMaterial, blackMaterial)

    for (const key of keyLayout()) {
      const centerX = key.x + key.width / 2
      // White keys run from the front edge (z = 0) back to the now line; black keys sit at the
      // back, flush with the white keys' back edge.
      const centerZ = key.isBlack ? -KEYBOARD.whiteLength + key.length / 2 : -key.length / 2
      const top = key.raised
      const body = new Mesh(
        key.isBlack ? blackBox : whiteBox,
        key.isBlack ? blackMaterial : whiteMaterial,
      )
      body.position.set(centerX, top - KEY_DEPTH / 2, centerZ)

      const overlayMaterial = new MeshBasicMaterial({
        color: new Color(PITCH_CLASS_COLORS[key.midi % 12]?.hex ?? '#FFFFFF'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
      this.materials.push(overlayMaterial)
      const overlay = new Mesh(key.isBlack ? blackTop : whiteTop, overlayMaterial)
      overlay.position.set(centerX, top + OVERLAY_LIFT, centerZ)
      overlay.visible = false
      overlay.renderOrder = 6
      this.overlays.push(overlay)
      this.group.add(body, overlay)
    }
  }

  /** States in key order, as returned by KeyStates.at(). */
  update(states: readonly KeyState[]): void {
    states.forEach((state, i) => {
      const overlay = this.overlays[i]
      if (overlay === undefined) return
      overlay.visible = state.alpha > 0.001
      overlay.material.opacity = state.alpha
    })
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose()
    for (const m of this.materials) m.dispose()
  }
}
