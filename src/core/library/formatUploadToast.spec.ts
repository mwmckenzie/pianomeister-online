// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { formatUploadToast } from './formatUploadToast'

const toast = (added: string[], duplicates: string[] = [], rejected = 0, filtersCleared = false) =>
  formatUploadToast({ added, duplicates, rejected, filtersCleared })

describe('formatUploadToast', () => {
  it('names one new song, counts several', () => {
    expect(toast(['Clair de Lune'])).toBe('Added “Clair de Lune”')
    expect(toast(['A', 'B', 'C'])).toBe('3 songs added')
  })

  it('points at a song already there', () => {
    expect(toast([], ['Minuet in G'])).toBe('Already in your library: Minuet in G')
    expect(toast([], ['A', 'B'])).toBe('2 songs already in your library')
  })

  it('reports mixed drops, rejections and cleared filters', () => {
    expect(toast(['A', 'B'], ['C'])).toBe('2 added · 1 already in your library')
    expect(toast(['A'], [], 2)).toBe('Added “A” · 2 rejected')
    expect(toast(['A'], [], 0, true)).toBe('Added “A” · filters cleared to show it')
  })

  it('says nothing when no file came through', () => {
    expect(toast([], [], 3)).toBe('')
  })
})
