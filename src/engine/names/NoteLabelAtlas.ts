import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from 'three'

import { noteLabel } from '@/core/noteLabel'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { KEYBOARD } from '../model/KEYBOARD'

/** Cells per row and cell size in pixels (wide enough for "C♯4"). */
export const ATLAS_COLUMNS = 8
export const ATLAS_ROWS = 11
export const CELL_W = 128
export const CELL_H = 64
/** Font size the names are drawn at; a label's on-screen text size scales the cell from it. */
export const ATLAS_FONT_PX = 40

const FONT = `600 ${ATLAS_FONT_PX}px "Inter Tight", Inter, system-ui, sans-serif`

type NameOptions = Pick<PlayerSettings['names'], 'octave' | 'accidentals'>

/**
 * The 88 note names (brief decision 114) drawn once into a texture, in the UI font (Inter
 * Tight semibold). Red holds the text, green a soft halo around it; the shaders colour both,
 * so text colour and shadow strength are settings, not baked in. Cell i holds MIDI 21 + i.
 * Redrawn when the name options change, and once the font has loaded.
 */
export class NoteLabelAtlas {
  readonly texture: CanvasTexture
  /** Each name's width in ems, by key index (for sizing key-top labels to fit). */
  readonly glyphEms = new Float32Array(88).fill(1)
  /** Called after each redraw (the font loading changes widths). */
  onDraw: (() => void) | null = null
  private readonly canvas: HTMLCanvasElement
  private key = ''
  private options: NameOptions = { octave: 'c', accidentals: 'sharps' }

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = ATLAS_COLUMNS * CELL_W
    this.canvas.height = ATLAS_ROWS * CELL_H
    // No colour space: the channels are coverage, read as they are.
    this.texture = new CanvasTexture(this.canvas)
    this.texture.minFilter = LinearMipmapLinearFilter
    this.texture.magFilter = LinearFilter
    this.texture.anisotropy = 4
    this.draw(this.options)
    // The self-hosted font may arrive after the first draw: draw again with it.
    void document.fonts?.load(FONT).then(() => {
      this.key = ''
      this.draw(this.options)
    })
  }

  draw(options: NameOptions): void {
    this.options = options
    const key = `${options.octave}|${options.accidentals}`
    if (key === this.key) return
    this.key = key
    const { width, height } = this.canvas
    const text = layer(width, height, options, false)
    const halo = layer(width, height, options, true)
    const ctx = this.canvas.getContext('2d')
    if (text === null || halo === null || ctx === null) return
    const out = ctx.createImageData(width, height)
    for (let i = 0; i < out.data.length; i += 4) {
      out.data[i] = text[i + 3] ?? 0
      out.data[i + 1] = halo[i + 3] ?? 0
      out.data[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
    this.texture.needsUpdate = true
    ctx.font = FONT
    for (let i = 0; i < 88; i++) {
      this.glyphEms[i] = ctx.measureText(noteLabel(KEYBOARD.lowest + i, options)).width / ATLAS_FONT_PX
    }
    this.onDraw?.()
  }

  dispose(): void {
    this.texture.dispose()
  }
}

/** One coverage layer (alpha): the names, or their blurred, widened halo. */
function layer(
  width: number,
  height: number,
  options: NameOptions,
  halo: boolean,
): Uint8ClampedArray | null {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx === null) return null
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.font = FONT
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = '#FFFFFF'
  if (halo) {
    ctx.shadowColor = '#FFFFFF'
    ctx.shadowBlur = 9
    ctx.lineWidth = 7
  }
  for (let i = 0; i < 88; i++) {
    const name = noteLabel(KEYBOARD.lowest + i, options)
    const x = (i % ATLAS_COLUMNS) * CELL_W + CELL_W / 2
    const y = Math.floor(i / ATLAS_COLUMNS) * CELL_H + CELL_H / 2 + 2
    if (halo) ctx.strokeText(name, x, y)
    ctx.fillText(name, x, y)
  }
  return ctx.getImageData(0, 0, width, height).data
}

/** The atlas UV rectangle (u0, v0, u1, v1) of a key index 0–87, for the shaders. */
export function atlasCell(index: number): readonly [number, number, number, number] {
  const col = index % ATLAS_COLUMNS
  const row = Math.floor(index / ATLAS_COLUMNS)
  // Canvas rows run down; texture v runs up (flipY).
  const u0 = col / ATLAS_COLUMNS
  const v1 = 1 - row / ATLAS_ROWS
  return [u0, v1 - 1 / ATLAS_ROWS, u0 + 1 / ATLAS_COLUMNS, v1]
}
