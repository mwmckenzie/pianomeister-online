// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { assignmentHandOf } from './assignmentHandOf'
import { needsHandsCheck } from './needsHandsCheck'
import type { SongHands } from './SongHands'
import { voiceLabel } from './voiceLabel'
import { voiceNote } from './voiceNote'

const voice = { id: '1:0', track: 1, channel: 0, trackName: '', program: 0, noteCount: 412 }
const guess = (role: 'both' | 'other' | 'right') => ({
  voiceId: '1:0',
  role,
  confidence: 1,
  reasons: [],
})

describe('voice texts', () => {
  it('name the track, else the instrument', () => {
    expect(voiceLabel({ ...voice, trackName: 'Piano RH' })).toBe('Track 1 · ch 0 · Piano RH')
    expect(voiceLabel({ ...voice, program: 48 })).toBe('Track 1 · ch 0 · String Ensemble 1')
    expect(voiceLabel({ ...voice, program: undefined })).toContain('Acoustic Grand Piano')
    expect(voiceLabel({ ...voice, channel: 9 })).toBe('Track 1 · ch 9 · Drums')
  })

  it('say what detection thinks', () => {
    expect(voiceNote(voice, guess('both'))).toBe('412 notes · both hands')
    expect(voiceNote(voice, guess('other'))).toBe('412 notes · other')
    expect(voiceNote({ ...voice, noteCount: 1 }, guess('other'))).toBe('1 note · few notes')
    expect(voiceNote(voice, undefined)).toBe('412 notes')
  })
})

describe('needsHandsCheck', () => {
  const hands = (over: Partial<SongHands>): SongHands => ({
    source: 'detected',
    confidence: 0.58,
    summary: null,
    ...over,
  })

  it('follows the threshold, on the percent as shown', () => {
    expect(needsHandsCheck(hands({}), 70)).toBe(true)
    expect(needsHandsCheck(hands({}), 58)).toBe(false)
    expect(needsHandsCheck(hands({ confidence: 0.696 }), 70)).toBe(false)
    expect(needsHandsCheck(hands({ confidence: null }), 70)).toBe(false)
  })

  it('is cleared by the player’s own hands', () => {
    expect(needsHandsCheck(hands({ source: 'user' }), 70)).toBe(false)
    expect(needsHandsCheck(hands({ source: 'default' }), 70)).toBe(false)
  })
})

describe('assignmentHandOf', () => {
  it('reads each note’s hand by id, and refuses hands of another file', () => {
    const note = (id: string) => ({
      id,
      track: 0,
      midi: 60,
      channel: 0,
      startTick: 0,
      endTick: 1,
      velocity: 1,
    })
    const handOf = assignmentHandOf(['0:1', '0:2', '0:3'], 'RL-')
    expect(['0:1', '0:2', '0:3', '9:9'].map((id) => handOf?.(note(id)))).toEqual([
      'right',
      'left',
      null,
      null,
    ])
    expect(assignmentHandOf(['0:1'], 'RL')).toBeNull()
  })
})
