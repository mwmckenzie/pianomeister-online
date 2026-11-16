<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { constrainKeyboard } from '@/core/settings/constrainKeyboard'
import { SETTING_RANGES } from '@/core/settings/SETTING_RANGES'
import type { RenderInfo } from '@/engine/RenderInfo'

import { useSettingsStore } from '../stores/settingsStore'
import SettingSlider from './SettingSlider.vue'

const props = defineProps<{
  /** Live render readout from the engine (non-reactive), polled while the panel is open. */
  readonly renderStatus?: () => { readonly info: RenderInfo; readonly frameMs: number } | null
}>()
const emit = defineEmits<{ close: [] }>()
const store = useSettingsStore()
const { settings } = storeToRefs(store)
const R = SETTING_RANGES

const lineColors = [
  { key: 'lane', label: 'Lane lines' },
  { key: 'bar', label: 'Bar lines' },
  { key: 'beat', label: 'Beat lines' },
  { key: 'pedal', label: 'Pedal band' },
] as const

/** Slider maxima that depend on other keyboard settings (the store clamps values to them). */
const limits = computed(() => {
  const k = settings.value.keyboard
  const blackHeight = Math.min(R.keyboard.blackHeight[1], k.thickness)
  return {
    blackHeight,
    pressDepthWhite: Math.min(R.keyboard.pressDepthWhite[1], k.thickness),
    pressDepthBlack: constrainKeyboard({ ...k, pressDepthBlack: Infinity }).pressDepthBlack,
  }
})

const percent = (v: number) => `${Math.round(v * 100)}%`
const units = (v: number) => v.toFixed(2)
const times = (v: number) => `${v.toFixed(2)}×`

const readout = ref('')
let poll = 0

function updateReadout(): void {
  const status = props.renderStatus?.()
  if (status === null || status === undefined) {
    readout.value = ''
    return
  }
  const { info, frameMs } = status
  readout.value =
    `${info.width} × ${info.height} px (pixel ratio ${info.pixelRatio.toFixed(2)}) · ` +
    `${frameMs.toFixed(2)} ms per frame (CPU)`
}

onMounted(() => {
  updateReadout()
  poll = window.setInterval(updateReadout, 500)
})
onBeforeUnmount(() => window.clearInterval(poll))
</script>

<template>
  <aside class="panel" aria-label="Settings">
    <header>
      <h2>Settings</h2>
      <button type="button" aria-label="Close settings" @click="emit('close')">✕</button>
    </header>

    <fieldset>
      <legend>Camera</legend>
      <SettingSlider
        v-model="settings.camera.tiltDeg"
        label="Tilt"
        :range="R.camera.tiltDeg"
        :step="1"
        :format="(v) => `${v}°`"
        testid="setting-tilt"
      />
      <SettingSlider
        v-model="settings.camera.distanceOffset"
        label="Distance"
        :range="R.camera.distanceOffset"
        :step="0.05"
        :format="units"
      />
      <SettingSlider
        v-model="settings.camera.pan"
        label="Pan"
        :range="R.camera.pan"
        :step="0.5"
        :format="(v) => v.toFixed(1)"
      />
    </fieldset>

    <fieldset>
      <legend>Highway &amp; keys</legend>
      <SettingSlider
        v-model="settings.highway.lookAheadBeats"
        label="Look-ahead"
        :range="R.highway.lookAheadBeats"
        :step="1"
        :format="(v) => `${v} beats`"
      />
      <SettingSlider
        v-model="settings.keys.fadeBeats"
        label="Key fade-in"
        :range="R.keys.fadeBeats"
        :step="0.25"
        :format="(v) => `${v} beats`"
      />
      <SettingSlider
        v-model="settings.keys.maxApproachAlpha"
        label="Max approach"
        :range="R.keys.maxApproachAlpha"
        :step="0.05"
        :format="percent"
      />
      <label class="check">
        <input
          v-model="settings.highway.blackLaneShading"
          type="checkbox"
          data-testid="setting-lane-shading"
        />
        Darker black-key lanes
      </label>
      <SettingSlider
        v-if="settings.highway.blackLaneShading"
        v-model="settings.highway.blackLaneShadingStrength"
        label="Lane shading"
        :range="R.highway.blackLaneShadingStrength"
        :step="0.01"
        :format="percent"
      />
    </fieldset>

    <fieldset>
      <legend>Keyboard</legend>
      <SettingSlider
        v-model="settings.keyboard.thickness"
        label="Key thickness"
        :range="R.keyboard.thickness"
        :step="0.05"
        :format="units"
      />
      <SettingSlider
        v-model="settings.keyboard.gap"
        label="Gap between keys"
        :range="R.keyboard.gap"
        :step="0.01"
        :format="units"
        testid="setting-gap"
      />
      <SettingSlider
        v-model="settings.keyboard.blackLengthRatio"
        label="Black key length"
        :range="R.keyboard.blackLengthRatio"
        :step="0.01"
        :format="percent"
      />
      <SettingSlider
        v-model="settings.keyboard.blackHeight"
        label="Black key height"
        :range="[R.keyboard.blackHeight[0], limits.blackHeight]"
        :step="0.01"
        :format="units"
        testid="setting-black-height"
      />
      <label class="row">
        Edges
        <select v-model="settings.keyboard.edgeProfile" data-testid="setting-edge-profile">
          <option value="none">Square</option>
          <option value="chamfer">Chamfer</option>
          <option value="rounded">Rounded</option>
        </select>
      </label>
      <SettingSlider
        v-if="settings.keyboard.edgeProfile !== 'none'"
        v-model="settings.keyboard.edgeSize"
        label="Edge size"
        :range="R.keyboard.edgeSize"
        :step="0.005"
        :format="(v) => v.toFixed(3)"
      />
      <label class="check">
        <input v-model="settings.keyboard.animate" type="checkbox" /> Keys move when played
      </label>
      <template v-if="settings.keyboard.animate">
        <SettingSlider
          v-model="settings.keyboard.pressDepthWhite"
          label="White key press depth"
          :range="[R.keyboard.pressDepthWhite[0], limits.pressDepthWhite]"
          :step="0.01"
          :format="units"
        />
        <SettingSlider
          v-model="settings.keyboard.pressDepthBlack"
          label="Black key press depth"
          :range="[R.keyboard.pressDepthBlack[0], limits.pressDepthBlack]"
          :step="0.01"
          :format="units"
          testid="setting-press-black"
        />
        <SettingSlider
          v-model="settings.keyboard.pivotOffsetWhite"
          label="White key pivot behind the key"
          :range="R.keyboard.pivotOffsetWhite"
          :step="0.1"
          :format="(v) => v.toFixed(1)"
        />
        <SettingSlider
          v-model="settings.keyboard.pivotOffsetBlack"
          label="Black key pivot behind the key"
          :range="R.keyboard.pivotOffsetBlack"
          :step="0.1"
          :format="(v) => v.toFixed(1)"
        />
      </template>
      <button type="button" @click="store.resetSection('keyboard')">Reset to grand piano</button>
    </fieldset>

    <fieldset>
      <legend>Notes</legend>
      <label class="check">
        <input v-model="settings.notes.heads3d" type="checkbox" data-testid="setting-heads3d" />
        3D note heads
      </label>
      <template v-if="settings.notes.heads3d">
        <SettingSlider
          v-model="settings.notes.headHeight"
          label="Head height"
          :range="R.notes.headHeight"
          :step="0.05"
          :format="units"
        />
        <label class="check">
          <input v-model="settings.notes.headRounded" type="checkbox" /> Rounded head edges
        </label>
      </template>
      <label class="row">
        Black-key lane notes
        <select v-model="settings.notes.blackLiftMode" data-testid="setting-lift-mode">
          <option value="keys">at black key height</option>
          <option value="manual">at a set height</option>
        </select>
      </label>
      <SettingSlider
        v-if="settings.notes.blackLiftMode === 'manual'"
        v-model="settings.notes.blackLift"
        label="Lift"
        :range="R.notes.blackLift"
        :step="0.01"
        :format="units"
        testid="setting-lift"
      />
      <label class="check">
        <input v-model="settings.notes.contactShadow" type="checkbox" /> Shadow under black-lane
        notes
      </label>
      <SettingSlider
        v-if="settings.notes.contactShadow"
        v-model="settings.notes.shadowStrength"
        label="Shadow strength"
        :range="R.notes.shadowStrength"
        :step="0.01"
        :format="percent"
      />
      <SettingSlider
        v-model="settings.notes.sustainCenterTransparency"
        label="Sustain transparency, centre"
        :range="R.notes.sustainCenterTransparency"
        :step="0.05"
        :format="percent"
      />
      <SettingSlider
        v-model="settings.notes.sustainEdgeTransparency"
        label="Sustain transparency, edges"
        :range="R.notes.sustainEdgeTransparency"
        :step="0.05"
        :format="percent"
      />
    </fieldset>

    <fieldset>
      <legend>Colours</legend>
      <label class="color">
        Background <input v-model="settings.colors.background" type="color" />
      </label>
      <label class="color">
        Highway <input v-model="settings.colors.highway" type="color" />
      </label>
      <div v-for="line in lineColors" :key="line.key" class="color-row">
        <label class="color">
          {{ line.label }} <input v-model="settings.colors[line.key]" type="color" />
        </label>
        <input
          v-model.number="settings.opacity[line.key]"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :aria-label="`${line.label} opacity`"
        />
        <output>{{ percent(settings.opacity[line.key]) }}</output>
      </div>
    </fieldset>

    <fieldset>
      <legend>Effects</legend>
      <label class="check">
        <input v-model="settings.effects.enabled" type="checkbox" /> Now-line sparks and glow
      </label>
      <template v-if="settings.effects.enabled">
        <label class="check">
          <input v-model="settings.effects.velocityScaling" type="checkbox" /> Size follows velocity
        </label>
        <template v-if="settings.effects.velocityScaling">
          <SettingSlider
            v-model="settings.effects.minScale"
            label="Size at softest"
            :range="R.effects.minScale"
            :step="0.05"
            :format="times"
          />
          <SettingSlider
            v-model="settings.effects.maxScale"
            label="Size at loudest"
            :range="R.effects.maxScale"
            :step="0.05"
            :format="times"
          />
        </template>
      </template>
    </fieldset>

    <fieldset>
      <legend>Render quality</legend>
      <label class="check">
        <input v-model="settings.render.scaleAuto" type="checkbox" /> Resolution: match the display
      </label>
      <SettingSlider
        v-if="!settings.render.scaleAuto"
        v-model="settings.render.scale"
        label="Render scale"
        :range="R.render.scale"
        :step="0.25"
        :format="times"
      />
      <SettingSlider
        v-model="settings.render.maxPixelRatio"
        label="Max pixel ratio"
        :range="R.render.maxPixelRatio"
        :step="0.25"
        :format="times"
      />
      <label class="row">
        Anti-aliasing
        <select v-model="settings.render.antialias" data-testid="setting-antialias">
          <option value="off">Off</option>
          <option value="msaa">MSAA 4×</option>
          <option value="fxaa">FXAA</option>
          <option value="smaa">SMAA</option>
        </select>
      </label>
      <p class="readout" data-testid="render-readout">{{ readout }}</p>
    </fieldset>

    <button type="button" class="reset" @click="store.reset()">Reset to defaults</button>
  </aside>
</template>

<style scoped>
.panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(22rem, 100vw);
  overflow-y: auto;
  padding: 0.75rem 1rem 1.5rem;
  background: rgb(10 14 28 / 94%);
  border-left: 1px solid rgb(120 140 190 / 25%);
  font-size: 0.85rem;
  z-index: 10;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

fieldset {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgb(120 140 190 / 20%);
  border-radius: 6px;
}

legend {
  color: #9fb0d8;
}

output {
  color: #c8d4f0;
  font-variant-numeric: tabular-nums;
}

.color,
.check,
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0.35rem 0;
}

.check {
  justify-content: flex-start;
}

.color-row {
  display: grid;
  grid-template-columns: 9rem 1fr 2.5rem;
  align-items: center;
  gap: 0.5rem;
}

.readout {
  margin: 0.35rem 0 0;
  color: #8c9abf;
  font-variant-numeric: tabular-nums;
}

.reset {
  margin-top: 1rem;
  width: 100%;
}
</style>
