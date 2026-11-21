import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from 'three'

import { noteLabel } from '@/core/noteLabel'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { KEYBOARD } from '../model/KEYBOARD'

/** Cells per row and cell size in pixels (wide enough for "C♯4"). */
export const ATLAS_COLUMNS = 8
export const ATLAS_ROWS = 11
const CELL_W = 128
const CELL_H = 64

type NameOptions = Pick<PlayerSettings['names'], 'octave' | 'accidentals'>

/**
 * The 88 note names (brief decision 114) drawn once into a texture: light text with a dark
 * outline, so they read on white keys, black keys and every pitch colour. Cell i holds MIDI
 * 21 + i. Redrawn when the name options change.
 */
export class NoteLabelAtlas {
  readonly texture: CanvasTexture
  private readonly canvas: HTMLCanvasElement
  private key = ''

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = ATLAS_COLUMNS * CELL_W
    this.canvas.height = ATLAS_ROWS * CELL_H
    // No colour space: our shaders write display-space colour, so the pixels pass as they are.
    this.texture = new CanvasTexture(this.canvas)
    this.texture.minFilter = LinearMipmapLinearFilter
    this.texture.magFilter = LinearFilter
    this.texture.anisotropy = 4
    this.draw({ octave: 'c', accidentals: 'sharps' })
  }

  draw(options: NameOptions): void {
    const key = `${options.octave}|${options.accidentals}`
    if (key === this.key) return
    this.key = key
    const ctx = this.canvas.getContext('2d')
    if (ctx === null) return
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    for (let i = 0; i < 88; i++) {
      const text = noteLabel(KEYBOARD.lowest + i, options)
      const x = (i % ATLAS_COLUMNS) * CELL_W + CELL_W / 2
      const y = Math.floor(i / ATLAS_COLUMNS) * CELL_H + CELL_H / 2 + 2
      // Shrink long names to fit the cell.
      const size = text.length > 2 ? 40 : 46
      ctx.font = `600 ${size}px Inter, system-ui, sans-serif`
      ctx.lineWidth = 10
      ctx.strokeStyle = 'rgba(8, 10, 18, 0.9)'
      ctx.strokeText(text, x, y)
      ctx.fillStyle = '#F4F6FB'
      ctx.fillText(text, x, y)
    }
    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
  }
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
