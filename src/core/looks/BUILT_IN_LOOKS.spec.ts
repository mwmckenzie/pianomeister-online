// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import { LOOK_KEYS } from './LOOK_KEYS'

const byName = (name: string) => {
  const look = BUILT_IN_LOOKS.find((l) => l.name === name)
  if (look === undefined) throw new Error(`no look ${name}`)
  return look.values
}

describe('BUILT_IN_LOOKS (milestone 9.1, section C)', () => {
  it('lists Classic and the thirteen looks in picker order, with fixed ids', () => {
    expect(BUILT_IN_LOOKS.map((l) => l.name)).toEqual([
      'Classic',
      'Study',
      'Night Focus',
      'Blueprint',
      'Neon',
      'Ember',
      'Crystal',
      'Aurora',
      'Synthwave',
      'Inferno',
      'Stardust',
      'Mist',
      'Fireworks',
      'Hazard',
    ])
    expect(BUILT_IN_LOOKS.map((l) => l.id)).toContain('builtin:night-focus')
    expect(new Set(BUILT_IN_LOOKS.map((l) => l.id)).size).toBe(BUILT_IN_LOOKS.length)
    expect(BUILT_IN_LOOKS.every((l) => l.builtIn && l.id.startsWith('builtin:'))).toBe(true)
  })

  it('pins every look key and nothing else, so a default change never moves a look', () => {
    const keys = [...LOOK_KEYS].sort().join()
    const incomplete = BUILT_IN_LOOKS.filter((l) => Object.keys(l.values).sort().join() !== keys)
    expect(incomplete.map((l) => l.name)).toEqual([])
  })

  it('keeps the default camera, except Fireworks with a little more look-ahead', () => {
    const moved = BUILT_IN_LOOKS.filter(
      (l) => l.values['camera.tiltDeg'] !== 45 || l.values['camera.distanceOffset'] !== 0,
    )
    expect(moved.map((l) => l.name)).toEqual([])
    expect(byName('Fireworks')['highway.lookAheadBeats']).toBeGreaterThan(
      byName('Study')['highway.lookAheadBeats'] as number,
    )
  })

  it('uses the named options of the spec', () => {
    expect(byName('Study')).toMatchObject({
      'names.mode': 'both',
      'lines.octaves': true,
      'lines.octavesEF': true,
      'lines.nowStyle': 'thin',
      'effects.sparks': false,
      'effects.sustain': 'none',
      'effects.keySpill': false,
    })
    expect(byName('Night Focus')).toMatchObject({
      'colors.highway': '#05060A',
      'noteStyle.sustainFill': 'gradient',
      'lines.nowColor': 'primary',
      'effects.pulse': false,
    })
    expect(byName('Blueprint')).toMatchObject({
      'noteStyle.headFill': 'outline',
      'lines.bordersCustom': '#6FA8FF',
      'pedal.border': true,
      'pedal.fillOpacity': 0,
    })
    expect(byName('Neon')).toMatchObject({
      'noteStyle.headFill': 'neon',
      'lines.nowColor': 'pitch',
    })
    expect(byName('Ember')).toMatchObject({
      'effects.sustain': 'embers',
      'effects.scalingSparks': true,
      'lines.nowCustom': '#FFB46B',
    })
    expect(byName('Crystal')).toMatchObject({
      'noteStyle.headFill': 'crystal',
      'effects.glitter': true,
      'effects.keyCone': true,
    })
    expect(byName('Aurora')).toMatchObject({
      'effects.sustain': 'smoke',
      'lines.nowStyle': 'neon',
      'lines.nowColor': 'secondary',
      'effects.breathing': true,
    })
    expect(byName('Synthwave')).toMatchObject({
      'colors.highway': '#0A0612',
      'noteStyle.sustainFill': 'stripes',
      'lines.nowCustom': '#FF4FD8',
      'pedal.fill': 'stripes',
      'pedal.borderCustom': '#4FE3FF',
    })
    expect(byName('Inferno')).toMatchObject({
      'effects.flame': true,
      'effects.sustain': 'flames',
      'noteStyle.sustainFill': 'hotCore',
      'effects.keyCone': true,
    })
    expect(byName('Stardust')).toMatchObject({
      'noteStyle.headFill': 'bubbles',
      'effects.glitter': true,
      'lines.nowColor': 'pitch',
    })
    expect(byName('Mist')).toMatchObject({
      'noteStyle.sustainFill': 'smoke',
      'effects.sustain': 'smoke',
      'pedal.fill': 'smoke',
      'lines.borders': false,
      'lines.octaves': false,
    })
    expect(byName('Fireworks')).toMatchObject({
      'effects.explosion': true,
      'effects.glitter': false,
      'effects.sparks': false,
    })
    expect(byName('Hazard')).toMatchObject({
      'noteStyle.headStripeACustom': '#FFC21A',
      'noteStyle.edgeGlow': false,
      'lines.bordersGlow': 0,
      'render.bloomStrength': 0,
    })
  })

  it('has one onset effect at most where the spec names one', () => {
    const onsets = ['sparks', 'scalingSparks', 'flame', 'explosion', 'glitter']
    const busy = BUILT_IN_LOOKS.slice(1).filter(
      (look) => onsets.filter((e) => look.values[`effects.${e}` as never] === true).length > 1,
    )
    expect(busy.map((l) => l.name)).toEqual([])
  })
})
