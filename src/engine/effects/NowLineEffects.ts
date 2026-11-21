import { type Color, Group } from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import type { KeyBody } from '../model/KeyBody'
import { keyLayout } from '../model/keyLayout'
import { KEYBOARD } from '../model/KEYBOARD'
import type { KeyState } from '../model/KeyState'
import {
  type EffectKnobs,
  flashSpawn,
  type OnsetEffect,
  onsetSpawns,
  SUSTAIN_RATE,
  sustainSpawn,
} from '../model/particleSpawns'
import { srgb } from '../srgb'
import type { TimeUniforms } from '../TimeUniforms'
import { HeldGlow } from './HeldGlow'
import { type Emission, ParticleSystem } from './ParticleSystem'

type Effects = PlayerSettings['effects']

const ONSET_EFFECTS: readonly OnsetEffect[] = [
  'sparks',
  'scalingSparks',
  'flame',
  'explosion',
  'glitter',
]

const PALETTE: readonly Color[] = PITCH_CLASS_COLORS.map((c) => srgb(c.hex))

/** Smoke blends differently, so it has its own, smaller pool. */
const SMOKE_SHARE = 0.25

function knobs(e: Effects, prefix: OnsetEffect | 'sustain'): EffectKnobs {
  return {
    size: e[`${prefix}Size`],
    count: e[`${prefix}Count`],
    lifetime: e[`${prefix}Lifetime`],
    spread: e[`${prefix}Spread`],
  }
}

/**
 * Everything at the now line (brief decision 117): onset effects and sustain particles from GPU
 * particle pools sized by the quality preset's budget, and the milestone 8 held glow.
 */
export class NowLineEffects {
  readonly group = new Group()
  private readonly particles: ParticleSystem
  private readonly smoke: ParticleSystem
  private readonly held = new HeldGlow()
  private readonly keyTop = new Float32Array(88)
  /** Fractional particles owed to each held key (sustain spawning at a rate). */
  private readonly owed = new Float32Array(88)

  constructor(time: TimeUniforms, budget: number) {
    this.particles = new ParticleSystem(budget, time, false)
    this.smoke = new ParticleSystem(smokeCapacity(budget), time, true)
    keyLayout().forEach((key, i) => (this.keyTop[i] = key.raised))
    this.group.add(this.held.points, this.smoke.mesh, this.particles.mesh)
    if (this.particles.twin !== null) this.group.add(this.particles.twin.mesh)
  }

  setBudget(budget: number): void {
    this.particles.setCapacity(budget)
    this.smoke.setCapacity(smokeCapacity(budget))
  }

  setScale(scale: number): void {
    this.held.setScale(scale)
  }

  setKeyTops(bodies: readonly KeyBody[]): void {
    bodies.forEach((body, i) => (this.keyTop[i] = body.top))
    this.held.setKeyTops(bodies)
  }

  /** The effects of one onset; `scale` comes from the note's velocity. */
  onset(midi: number, scale: number, effects: Effects, reducedMotion: boolean): void {
    const index = midi - KEYBOARD.lowest
    const key = keyLayout()[index]
    if (key === undefined) return
    const at = this.emissionPoint(index, key.x + key.width / 2, midi)
    const out: Emission[] = []
    if (reducedMotion) {
      // One still flash per onset, if any onset effect is on (decision 54).
      if (ONSET_EFFECTS.some((e) => effects[e])) {
        out.push({ ...at, spawn: flashSpawn(scale, knobs(effects, 'sparks')) })
      }
    } else {
      for (const effect of ONSET_EFFECTS) {
        if (!effects[effect]) continue
        for (const spawn of onsetSpawns(
          effect,
          key.width,
          knobs(effects, effect),
          scale,
          Math.random,
        )) {
          out.push({ ...at, spawn })
        }
      }
    }
    this.particles.emit(out)
  }

  /** Sustain particles and the held glow for this frame. */
  update(
    dt: number,
    states: readonly KeyState[],
    effects: Effects,
    scaleOf: (velocity: number) => number,
    reducedMotion: boolean,
  ): void {
    const sustain = effects.sustain
    this.held.points.visible = sustain === 'glow'
    if (sustain === 'glow') this.held.update(dt, states, scaleOf, reducedMotion)
    if (sustain === 'glow' || sustain === 'none' || reducedMotion) {
      this.owed.fill(0)
      return
    }
    const rate = SUSTAIN_RATE[sustain] * effects.sustainCount
    const k = knobs(effects, 'sustain')
    const out: Emission[] = []
    const keys = keyLayout()
    const step = Math.min(dt, 0.1)
    states.forEach((state, i) => {
      if (!state.sounding) {
        this.owed[i] = 0
        return
      }
      const key = keys[i]
      if (key === undefined) return
      let owed = (this.owed[i] as number) + rate * step
      const scale = scaleOf(state.velocity)
      const at = this.emissionPoint(i, key.x + key.width / 2, key.midi)
      while (owed >= 1) {
        out.push({ ...at, spawn: sustainSpawn(sustain, key.width, k, scale, Math.random) })
        owed -= 1
      }
      this.owed[i] = owed
    })
    if (sustain === 'smoke') this.smoke.emit(out)
    else this.particles.emit(out)
  }

  /** Glow twins draw only while bloom runs. */
  syncGlow(bloomActive: boolean): void {
    this.particles.twin?.sync(bloomActive)
  }

  clear(): void {
    this.particles.clear()
    this.smoke.clear()
    this.held.clear()
    this.owed.fill(0)
  }

  dispose(): void {
    this.particles.dispose()
    this.smoke.dispose()
    this.held.dispose()
  }

  private emissionPoint(index: number, x: number, midi: number) {
    return {
      x,
      y: this.keyTop[index] as number,
      z: -KEYBOARD.whiteLength,
      color: PALETTE[midi % 12] as Color,
    }
  }
}

function smokeCapacity(budget: number): number {
  return Math.max(64, Math.round(budget * SMOKE_SHARE))
}
