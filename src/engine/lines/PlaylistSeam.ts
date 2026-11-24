import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
} from 'three'

import type { CrossfadeBand } from '@/core/playlists/CrossfadeBand'
import type { CrossfadeCurve } from '@/core/playlists/CrossfadeCurve'

import { KEYBOARD } from '../model/KEYBOARD'
import { srgb } from '../srgb'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import { LoopLines } from './LoopLines'

/** The seam line's fixed width and glow (board QGCrossfade: a 1.6 px core in a 5 px glow). */
const SEAM_WIDTH = 0.1
const SEAM_GLOW = 1.2
/** The band's tint opacity (board: the secondary colour at 0.06). */
const BAND_OPACITY = 0.06
/** The curves as timeGlsl's bandGain knows them. */
const CURVE_ID: Readonly<Record<CrossfadeCurve, number>> = {
  sequential: 0,
  sCurve: 1,
  equalPower: 2,
}
/** The label sprite's height on screen in CSS pixels (its 13 px text plus a little room). */
const LABEL_PX = 20

const BAND_VERTEX = /* glsl */ `
${TIME_GLSL}
varying float vTick;
void main() {
  float tick = mix(uBandStart, uBandEnd, position.y);
  vTick = tick;
  float shown = step(0.0, uBandDeck) * step(1.0, uBandEnd - uBandStart);
  vec3 world = vec3(position.x * ${KEYBOARD.width.toFixed(1)}, 0.004, tickToZ(tick));
  gl_Position = projectionMatrix * viewMatrix * vec4(world * shown, 1.0);
}
`

const BAND_FRAGMENT = /* glsl */ `
${TIME_GLSL}
uniform vec3 uColor;
varying float vTick;
void main() {
  float alpha = ${BAND_OPACITY.toFixed(2)} * hazeAlpha(vTick) * step(uTick, vTick) * bandGain(vTick);
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`

/**
 * The playlist seam (milestone 9.5 D, board QGCrossfade): a line where the next song starts, in
 * the seam colour with glow (the loop lines' renderer), the next song's "Title · Composer" along
 * it near the left edge (a constant-size label, drawn with the note names over the frame), and
 * the crossfade band — the faint tint where both songs sound. It shows in every HUD mode.
 */
export class PlaylistSeam {
  readonly lines: LoopLines
  readonly band: Mesh<PlaneGeometry, ShaderMaterial>
  readonly label: Sprite
  private readonly canvas = document.createElement('canvas')
  private readonly texture: CanvasTexture
  private seamTick: number | null = null
  private text = ''
  private color = '#7EE0C3'
  private on = true

  constructor(
    private readonly time: TimeUniforms,
    renderOrder: number,
  ) {
    this.lines = new LoopLines(time, 1, renderOrder)
    const geometry = new PlaneGeometry(1, 1, 1, 1)
    geometry.translate(0.5, 0.5, 0)
    this.band = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: BAND_VERTEX,
        fragmentShader: BAND_FRAGMENT,
        uniforms: { ...time, uColor: { value: srgb(this.color) } },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.band.frustumCulled = false
    this.band.renderOrder = renderOrder - 0.05
    this.texture = new CanvasTexture(this.canvas)
    this.texture.minFilter = LinearFilter
    this.label = new Sprite(
      new SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
      }),
    )
    this.label.center.set(0, 0)
    this.label.visible = false
  }

  /** Line on or off, and its colour (look keys lines.seam, lines.seamColor). */
  setStyle(on: boolean, color: string): void {
    this.on = on
    this.color = color
    this.lines.setStyle(on, color, SEAM_WIDTH, SEAM_GLOW)
    const u = this.band.material.uniforms.uColor
    if (u) u.value = srgb(color)
    this.draw()
  }

  /**
   * Where the next song starts (ticks) and its label; the band where both sound (`deck` = the
   * ending song's; null without an overlap). Null seam: nothing shows.
   */
  set(
    seam: { readonly tick: number; readonly label: string } | null,
    band: CrossfadeBand | null,
  ): void {
    this.seamTick = seam?.tick ?? null
    this.lines.place(seam === null ? [] : [{ tick: seam.tick, end: false }])
    this.time.uBandStart.value = band?.startTick ?? 0
    this.time.uBandEnd.value = band?.endTick ?? 0
    this.time.uBandDeck.value = band?.deck ?? -1
    this.time.uBandCurve.value = CURVE_ID[band?.curve ?? 'sequential']
    if (seam !== null && seam.label !== this.text) {
      this.text = seam.label
      this.draw()
    }
  }

  /**
   * Places the label at the line each frame (the seam scrolls), just beyond it near the left
   * edge, at a constant size on screen; hidden outside the visible highway.
   */
  update(viewportHeightPx: number, projectionScaleY: number): void {
    const tick = this.seamTick
    const t = this.time
    const ahead = tick === null ? -1 : tick - t.uTick.value
    const visible = this.on && tick !== null && ahead > 0 && ahead < 1.5 * t.uLookAheadTicks.value
    this.label.visible = visible
    if (!visible || tick === null) return
    const z = t.uNowZ.value - ahead * t.uUnitsPerTick.value
    this.label.position.set(1.2, 0.02, z - 0.08)
    // A sprite without size attenuation is `scale` × the projection's y scale × half the
    // viewport tall on screen: solve for LABEL_PX.
    const height =
      (2 * LABEL_PX) / (Math.max(1, viewportHeightPx) * Math.max(0.01, projectionScaleY))
    const aspect = this.canvas.width / Math.max(1, this.canvas.height)
    this.label.scale.set(height * aspect, height, 1)
  }

  dispose(): void {
    this.lines.dispose()
    this.band.geometry.dispose()
    this.band.material.dispose()
    this.label.material.dispose()
    this.texture.dispose()
  }

  /** Renders the label text (teal, a dark outline for legibility, like the board). */
  private draw(): void {
    const scale = 4
    const font = `500 ${13 * scale}px "Inter Tight", system-ui, sans-serif`
    const g = this.canvas.getContext('2d')
    if (g === null) return
    g.font = font
    const width = Math.ceil(g.measureText(this.text).width + 12 * scale)
    this.canvas.width = Math.max(1, width)
    this.canvas.height = 20 * scale
    g.font = font
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 4 * scale
    g.strokeStyle = '#05070F'
    g.strokeText(this.text, 6 * scale, 10 * scale)
    g.fillStyle = this.color
    g.fillText(this.text, 6 * scale, 10 * scale)
    this.texture.needsUpdate = true
  }
}
