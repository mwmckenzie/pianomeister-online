import { fileURLToPath } from 'node:url'

import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { practiceHistory } from './practiceHistory'
import { choose, seedBookmark, seedPractice, SONG_IDS } from './support'

/**
 * Screenshots for a human to review (npm run test:visual), saved under test-results/visual/ and
 * never committed. Milestone 5 views are zoomed (distance offset −0.4) so notes and keys are
 * large; the synthetic clarity demo has sharps and naturals sounding side by side, short and
 * long notes, repeated notes and a velocity ramp.
 */
const OUT = 'test-results/visual'
const PEDAL_DEMO = fileURLToPath(new URL('../test-fixtures/midi/pedal-demo.mid', import.meta.url))
const METER_DEMO = fileURLToPath(new URL('../test-fixtures/midi/meter-demo.mid', import.meta.url))
const CLARITY_DEMO = fileURLToPath(
  new URL('../test-fixtures/midi/clarity-demo.mid', import.meta.url),
)
const ZOOM = -0.4

type Settings = Record<string, Record<string, unknown>>

/** Seeds v3 settings (sections merged over the defaults) before the app loads. */
async function seed(page: Page, settings: Settings) {
  await page.addInitScript(
    (value) => {
      localStorage.setItem('pianomeister.settings', value)
    },
    JSON.stringify({ version: 3, settings }),
  )
}

/** Uploads a test file through the Library and opens it, so the player reopens it on load. */
async function openUpload(page: Page, file: string, title: string) {
  await page.goto('./#/library')
  await page.getByTestId('upload-input').setInputFiles(file)
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  await page.getByTestId('song-row').filter({ hasText: title }).click()
  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-title')).toHaveText(title)
}

/** Loads the player fresh (so ?guides and settings apply) and steps to the start of `bar`. */
async function showBar(page: Page, bar: number, guides = false) {
  await page.goto(guides ? './#/?guides=1' : './#/')
  await page.reload()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')
  for (let i = 1; i < bar; i++) await page.getByRole('button', { name: 'Next bar' }).click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText(`${bar}:1`)
  await settle(page)
}

/** Waits for a few rendered frames (key presses take ~40 ms to settle). */
async function settle(page: Page, frames = 20) {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let n = 0
        const tick = () => (++n >= count ? resolve() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
    frames,
  )
}

async function shoot(page: Page, name: string) {
  const shot = await page.screenshot({ path: `${OUT}/${name}.png` })
  expect(shot.byteLength).toBeGreaterThan(0)
}

const camera = (tiltDeg: number, distanceOffset = ZOOM, pan = 0) => ({
  camera: { tiltDeg, distanceOffset, pan },
})

// 1. Defaults, zoomed, at three tilts — Minuet (bar 5) and the clarity demo (bar 1).
for (const tilt of [30, 45, 70]) {
  test(`@visual Minuet zoomed, defaults, tilt ${tilt}`, async ({ page }) => {
    await seed(page, camera(tilt))
    await showBar(page, 5)
    await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
    await shoot(page, `m5-minuet-zoomed-tilt${tilt}`)
  })

  test(`@visual clarity demo zoomed, defaults, tilt ${tilt}`, async ({ page }) => {
    await seed(page, camera(tilt))
    await openUpload(page, CLARITY_DEMO, 'Clarity demo')
    await showBar(page, 1)
    await shoot(page, `m5-clarity-zoomed-tilt${tilt}`)
  })
}

// 2. Each item off vs on, on the clarity demo at tilt 45, zoomed.
const TOGGLES: readonly {
  readonly name: string
  readonly bar: number
  readonly variants: readonly { readonly label: string; readonly settings: Settings }[]
}[] = [
  {
    name: 'heads',
    bar: 3,
    variants: [
      { label: 'flat', settings: { notes: { heads3d: false } } },
      { label: '3d', settings: {} },
    ],
  },
  {
    name: 'black-outline',
    bar: 1,
    variants: [
      {
        label: 'off',
        settings: { notes: { blackOutline: false } },
      },
      { label: 'on', settings: {} },
    ],
  },
  {
    name: 'lane-shading',
    bar: 1,
    variants: [
      { label: 'off', settings: { highway: { blackLaneShading: false } } },
      { label: 'on', settings: {} },
    ],
  },
  {
    name: 'keys-pressed',
    bar: 8,
    variants: [
      { label: 'animate-off', settings: { keyboard: { animate: false } } },
      { label: 'animate-on', settings: {} },
    ],
  },
  {
    // Bevels must look the same on short and long heads, whatever the look-ahead.
    name: 'bevel-lookahead',
    bar: 3,
    variants: [
      { label: '2-beats', settings: { highway: { lookAheadBeats: 2 } } },
      { label: '32-beats', settings: { highway: { lookAheadBeats: 32 } } },
    ],
  },
  {
    // Lanes never move: with a wide gap, notes still meet key centres.
    name: 'gap',
    bar: 8,
    variants: [
      { label: '0', settings: { keyboard: { gap: 0 } } },
      { label: '0.15', settings: { keyboard: { gap: 0.15 } } },
    ],
  },
]

for (const toggle of TOGGLES) {
  for (const variant of toggle.variants) {
    test(`@visual clarity demo, ${toggle.name}: ${variant.label}`, async ({ page }) => {
      await seed(page, { ...camera(45), ...variant.settings })
      await openUpload(page, CLARITY_DEMO, 'Clarity demo')
      await showBar(page, toggle.bar)
      await shoot(page, `m5-${toggle.name}-${variant.label}`)
    })
  }
}

// 3. Key edge profiles, close up on the keys (tilt 30, closest distance).
for (const profile of ['none', 'chamfer', 'rounded'] as const) {
  test(`@visual key edges close-up: ${profile}`, async ({ page }) => {
    await seed(page, { ...camera(30, -0.6), keyboard: { edgeProfile: profile } })
    await openUpload(page, CLARITY_DEMO, 'Clarity demo')
    await showBar(page, 8)
    await shoot(page, `m5-edges-${profile}`)
  })
}

// 3b. Pressed keys close up (round 2): black keys next to pressed white keys in the final chord
// (C, C#, D#, E, F#, G), at the default depths, at the deepest black press, and with the black
// keys as high as allowed. Values beyond the limits are clamped, so 9 means "the maximum".
const PRESS_VARIANTS: readonly { readonly label: string; readonly keyboard: Settings[string] }[] = [
  { label: 'default', keyboard: {} },
  { label: 'black-max-depth', keyboard: { pressDepthBlack: 9 } },
  { label: 'black-max-height', keyboard: { blackHeight: 9, pressDepthBlack: 9 } },
]
for (const tilt of [30, 45]) {
  for (const variant of PRESS_VARIANTS) {
    test(`@visual pressed keys close-up, tilt ${tilt}: ${variant.label}`, async ({ page }) => {
      await seed(page, { ...camera(tilt, -0.6), keyboard: variant.keyboard })
      await openUpload(page, CLARITY_DEMO, 'Clarity demo')
      await showBar(page, 8)
      await shoot(page, `m5-press-tilt${tilt}-${variant.label}`)
    })
  }
}

// 4. Render quality: every anti-aliasing mode at the same view as the "before" baseline
// (Minuet, bar 5, tilt 45, zoomed), and the drawing buffer after a device-pixel-ratio change.
for (const mode of ['off', 'msaa', 'fxaa', 'smaa'] as const) {
  test(`@visual render quality: ${mode}`, async ({ page }) => {
    await seed(page, { ...camera(45), render: { antialias: mode } })
    await showBar(page, 5)
    await shoot(page, `m5-render-${mode}`)
  })
}

test('@visual render quality after a device-pixel-ratio change (monitor switch / zoom)', async ({
  page,
}) => {
  await seed(page, camera(45))
  await showBar(page, 5)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1.5,
    mobile: false,
  })
  await expect
    .poll(() => page.evaluate(() => document.querySelector('canvas')?.width ?? 0))
    .toBe(2400)
  await settle(page)
  await shoot(page, 'm5-render-after-dpr-1.5')
})

// 5. Milestone 3/4 views kept for regression: default distance with look-ahead guides, the
// pedal demo, and the library.
for (const guides of [false, true]) {
  test(`@visual Minuet at bar 5, tilt 45${guides ? ', guides' : ''}`, async ({ page }) => {
    await seed(page, camera(45, 0))
    await showBar(page, 5, guides)
    await shoot(page, `minuet-bar5-tilt-45${guides ? '-guides' : ''}`)
  })
}

test('@visual pedal demo at bar 2', async ({ page }) => {
  await seed(page, camera(45, 0))
  await openUpload(page, PEDAL_DEMO, 'Pedal demo')
  await showBar(page, 2)
  await shoot(page, 'pedal-demo-bar2')
})

test('@visual library page with details panel', async ({ page }) => {
  await openUpload(page, PEDAL_DEMO, 'Pedal demo')
  await page.goto('./#/library')
  await page.getByTestId('song-row').filter({ hasText: 'Pedal demo' }).click()
  await expect(page.getByTestId('hand-ch0')).toBeVisible()
  await shoot(page, 'library-details')
})

// 6. Milestone 6 screens (UI foundation): each at 1280×720 and 1024×768 (iPad landscape), with
// the default theme (Glacier) and Ember. Compare with docs/design/m6/.
const M6_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
] as const
const M6_THEMES = [
  { name: 'glacier', appearance: {} },
  { name: 'ember', appearance: { primary: '#FFB38A', secondary: '#FFD98A' } },
] as const

for (const viewport of M6_VIEWPORTS) {
  for (const theme of M6_THEMES) {
    const suffix = `${viewport.width}x${viewport.height}-${theme.name}`

    test.describe(`m6 ${suffix}`, () => {
      test.use({ viewport })

      test.beforeEach(async ({ page }) => {
        // The sidebar's open state is UI state (not a setting): start closed, Keyboard expanded.
        await page.addInitScript(() => {
          localStorage.setItem(
            'pianomeister.ui',
            JSON.stringify({ sidebarOpen: false, sidebarSections: ['keyboard'] }),
          )
        })
        await seed(page, { appearance: theme.appearance, audio: { leftVolume: 0.6 } })
      })

      test(`@visual m6 player ${suffix}`, async ({ page }) => {
        await showBar(page, 18)
        // Off the controls, so none shows its hover state.
        await page.mouse.move(640, 500)
        await shoot(page, `m6-player-${suffix}`)
      })

      test(`@visual m6 player with sidebar ${suffix}`, async ({ page }) => {
        await showBar(page, 18)
        await page.getByTestId('toggle-sidebar').click()
        await expect(page.getByTestId('playfield-sidebar')).toBeVisible()
        await settle(page)
        await settle(page, 30)
        await shoot(page, `m6-player-sidebar-${suffix}`)
      })

      for (const tab of ['audio', 'appearance'] as const) {
        test(`@visual m6 settings ${tab} ${suffix}`, async ({ page }) => {
          await showBar(page, 18)
          await page.getByTestId('toggle-sidebar').click()
          await page.getByTestId('open-all-settings').click()
          await page.getByTestId(`tab-${tab}`).click()
          await page.mouse.move(0, 0)
          await settle(page, 30)
          await shoot(page, `m6-settings-${tab}-${suffix}`)
        })
      }

      test(`@visual m6 picker ${suffix}`, async ({ page }) => {
        await showBar(page, 18)
        await page.getByTestId('open-picker').click()
        await expect(page.getByTestId('song-picker')).toBeVisible()
        await settle(page, 30)
        await shoot(page, `m6-picker-${suffix}`)
      })

      test(`@visual m6 picker meter changes ${suffix}`, async ({ page }) => {
        await openUpload(page, METER_DEMO, 'Meter demo')
        await page.getByTestId('open-picker').click()
        await expect(page.getByTestId('picker-meter')).toHaveText('4/4+')
        await page.getByTestId('meter-changes').click()
        await expect(page.getByTestId('meter-runs')).toBeVisible()
        await settle(page, 30)
        await shoot(page, `m6-picker-meter-${suffix}`)
      })

      test(`@visual m6 loop popover ${suffix}`, async ({ page }) => {
        await showBar(page, 18)
        await page.getByTestId('open-loop').click()
        await page.getByTestId('loop-from').fill('17')
        await page.getByTestId('loop-to').fill('32')
        await page.getByTestId('loop-to').press('Enter')
        await page.getByTestId('loop-set').click()
        const preRoll = page.getByTestId('setting-practice-preRollBeats').getByRole('slider')
        await preRoll.focus()
        for (let i = 0; i < 4; i++) await preRoll.press('ArrowLeft')
        await settle(page, 30)
        await shoot(page, `m6-loop-popover-${suffix}`)
      })

      test(`@visual m6 library ${suffix}`, async ({ page }) => {
        // Through the player, so the library's backdrop is the scene's last frame.
        await showBar(page, 18)
        await page.getByTestId('open-picker').click()
        await page.getByTestId('open-library').click()
        await page.getByTestId('song-row').filter({ hasText: 'Minuet' }).click()
        await expect(page.getByTestId('song-details')).toBeVisible()
        // The composer list open, as in the mockup.
        await page.getByRole('button', { name: 'Show all composers' }).click()
        await settle(page, 30)
        await shoot(page, `m6-library-${suffix}`)
      })
    })
  }
}

// 7. Milestone 7 screens (profiles, bookmarks, stats), with a seeded two-week history at a
// fixed time, so "Today" and the charts are the same on every run. Compare with
// docs/design/m6/source/QGPicker, QGLibrary and QGBookmarks.
const M7_NOW = new Date('2026-11-18T15:00:00')

for (const viewport of M6_VIEWPORTS) {
  for (const theme of M6_THEMES) {
    const suffix = `${viewport.width}x${viewport.height}-${theme.name}`

    test.describe(`m7 ${suffix}`, () => {
      test.use({ viewport })

      test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(M7_NOW)
        await page.addInitScript(() => {
          localStorage.setItem(
            'pianomeister.ui',
            JSON.stringify({ sidebarOpen: false, sidebarSections: ['keyboard'] }),
          )
        })
        await seed(page, { appearance: theme.appearance })
        await page.goto('./#/')
        await expect(page.getByTestId('hud-bars')).toHaveText('64')
        await seedPractice(page, practiceHistory(M7_NOW.getTime()))
        await expect(page.getByTestId('hud-bookmark')).toHaveText('B section')
      })

      test(`@visual m7 player bookmark ${suffix}`, async ({ page }) => {
        // The bookmark as loaded: icon and name on the now-playing line (decision 60).
        await expect(page.getByTestId('hud-entry-icon')).toBeVisible()
        for (let i = 1; i < 17; i++) await page.getByRole('button', { name: 'Next bar' }).click()
        await page.getByTestId('menu-profile').hover()
        await settle(page, 30)
        await shoot(page, `m7-player-bookmark-${suffix}`)
      })

      test(`@visual m7 loop popover bookmark ${suffix}`, async ({ page }) => {
        await page.getByTestId('open-loop').click()
        await page.getByTestId('loop-to').fill('28')
        await page.getByTestId('loop-to').press('Enter')
        await expect(page.getByTestId('back-to-name')).toHaveText('B section')
        await settle(page, 30)
        await shoot(page, `m7-loop-popover-${suffix}`)
      })

      test(`@visual m7.6 player custom setup ${suffix}`, async ({ page }) => {
        // A tempo change: the line shows the setup itself, plain and dim, with no icon.
        await page.getByTestId('open-tempo').click()
        const slider = page.getByTestId('tempo-slider').getByRole('slider')
        await slider.focus()
        await slider.press('ArrowLeft')
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('hud-custom')).toBeVisible()
        await page.getByTestId('hud-entry').hover()
        await settle(page, 30)
        await shoot(page, `m7-6-player-custom-${suffix}`)
      })

      test(`@visual m7.6 player full song ${suffix}`, async ({ page }) => {
        await page.getByTestId('open-picker').click()
        await page.getByTestId('picker-song').filter({ hasText: 'Minuet' }).click()
        await page.getByTestId('picker-full-song').click()
        await page.getByTestId('picker-load').click()
        await expect(page.getByTestId('hud-full-song')).toBeVisible()
        await settle(page, 30)
        await shoot(page, `m7-6-player-full-song-${suffix}`)
      })

      test(`@visual m7.6 picker other setups ${suffix}`, async ({ page }) => {
        await page.getByTestId('open-picker').click()
        await page.getByTestId('picker-song').filter({ hasText: 'Minuet' }).click()
        await expect(page.getByTestId('picker-other-setups')).toBeVisible()
        await settle(page, 30)
        await shoot(page, `m7-6-picker-other-setups-${suffix}`)
      })

      test(`@visual m7 picker ${suffix}`, async ({ page }) => {
        await page.getByTestId('open-picker').click()
        await page.getByTestId('picker-song').filter({ hasText: 'Minuet' }).click()
        await page.getByTestId('picker-bookmark').filter({ hasText: 'B section' }).click()
        await expect(page.getByTestId('picker-entry-name')).toHaveText('B section')
        await settle(page, 30)
        await shoot(page, `m7-picker-${suffix}`)
      })

      test(`@visual m7 library ${suffix}`, async ({ page }) => {
        await page.getByTestId('menu-library').click()
        await page.getByTestId('song-row').filter({ hasText: 'Minuet' }).click()
        await expect(page.getByTestId('song-details')).toBeVisible()
        await settle(page, 30)
        await shoot(page, `m7-library-${suffix}`)
      })

      test(`@visual m7 bookmarks ${suffix}`, async ({ page }) => {
        await page.getByTestId('menu-library').click()
        await page.getByTestId('tab-bookmarks').click()
        await page.getByTestId('bookmark-row').filter({ hasText: 'B section' }).click()
        await expect(page.getByTestId('bookmark-name')).toHaveValue('B section')
        await settle(page, 30)
        await shoot(page, `m7-bookmarks-${suffix}`)
        // A draft duplicate: its note at the top of the panel.
        await page.getByTestId('bookmark-duplicate').click()
        await expect(page.getByTestId('bookmark-duplicate-note')).toBeVisible()
        await page.getByTestId('bookmark-name').blur()
        await settle(page, 30)
        await shoot(page, `m7-bookmarks-duplicate-${suffix}`)
      })

      test(`@visual m7 profiles ${suffix}`, async ({ page }) => {
        await page.getByTestId('menu-settings').click()
        await page.getByTestId('tab-profiles').click()
        await expect(page.getByTestId('profile-row')).toHaveCount(2)
        await settle(page, 30)
        await shoot(page, `m7-profiles-${suffix}`)
      })

      // Confirm dialogs use AppDialog's standard layout (padding, title, footer): one size and
      // theme is enough to catch a dialog that loses it.
      if (suffix === '1280x720-glacier') {
        test(`@visual dialog discard duplicate ${suffix}`, async ({ page }) => {
          await page.getByTestId('menu-library').click()
          await page.getByTestId('tab-bookmarks').click()
          await page.getByTestId('bookmark-row').filter({ hasText: 'B section' }).click()
          await page.getByTestId('bookmark-duplicate').click()
          await page.getByTestId('bookmark-row').filter({ hasText: 'Left hand alone' }).click()
          await expect(page.getByTestId('discard-duplicate')).toBeVisible()
          await settle(page, 30)
          await shoot(page, `dialog-discard-duplicate-${suffix}`)
        })

        test(`@visual dialog profile delete ${suffix}`, async ({ page }) => {
          await page.getByTestId('menu-settings').click()
          await page.getByTestId('tab-profiles').click()
          await page
            .getByTestId('profile-row')
            .filter({ hasText: 'Anna' })
            .getByTestId('profile-delete')
            .click()
          await expect(page.getByTestId('profile-delete-dialog')).toBeVisible()
          await settle(page, 30)
          await shoot(page, `dialog-profile-delete-${suffix}`)
        })
      }
    })
  }
}

// 8. Milestone 7.5: Settings → Shortcuts (default, one changed, recording, a conflict, the
// Lists group with its role table), the loop popover's nudge buttons and the cheat sheet. No
// mockup: built from the milestone 6 settings patterns.
for (const viewport of M6_VIEWPORTS) {
  const suffix = `${viewport.width}x${viewport.height}-glacier`

  test.describe(`m7.5 ${suffix}`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          'pianomeister.ui',
          JSON.stringify({ sidebarOpen: false, sidebarSections: ['keyboard'] }),
        )
      })
      await seed(page, {})
      await page.goto('./#/')
      await expect(page.getByTestId('hud-bars')).toHaveText('64')
    })

    test(`@visual m7.5 shortcuts tab ${suffix}`, async ({ page }) => {
      await page.getByTestId('menu-settings').click()
      await page.getByTestId('tab-shortcuts').click()
      const playPause = page.getByTestId('shortcut-playPause')
      await expect(playPause).toBeVisible()
      await settle(page, 30)
      await shoot(page, `m7-5-shortcuts-${suffix}`)

      // One changed: Play / pause on K.
      await playPause.getByTestId('shortcut-key').click()
      await page.keyboard.press('k')
      await expect(playPause.getByTestId('shortcut-key')).toHaveText(['K'])
      await settle(page, 30)
      await shoot(page, `m7-5-shortcuts-changed-${suffix}`)

      // Recording a second key for Stop.
      await page.getByTestId('shortcut-stop').getByTestId('shortcut-add').click()
      await expect(page.getByTestId('shortcut-recording')).toBeFocused()
      await settle(page, 30)
      await shoot(page, `m7-5-shortcuts-recording-${suffix}`)

      // A conflict: M is the metronome's.
      await page.keyboard.press('m')
      await expect(page.getByTestId('shortcut-conflict')).toBeVisible()
      await settle(page, 30)
      await shoot(page, `m7-5-shortcuts-conflict-${suffix}`)
    })

    test(`@visual m7.5 shortcuts lists group ${suffix}`, async ({ page }) => {
      await page.getByTestId('menu-settings').click()
      await page.getByTestId('tab-shortcuts').click()
      await page
        .getByTestId('shortcuts-lists')
        .evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await settle(page, 30)
      await shoot(page, `m7-5-shortcuts-lists-${suffix}`)
    })

    test(`@visual m7.5 loop popover nudges ${suffix}`, async ({ page }) => {
      await page.getByTestId('open-loop').click()
      await page.getByTestId('loop-to-up').click()
      await expect(page.getByTestId('loop-value')).toHaveText('bars 1–5')
      await settle(page, 30)
      await shoot(page, `m7-5-loop-nudges-${suffix}`)
    })

    test(`@visual m7.5 cheat sheet ${suffix}`, async ({ page }) => {
      await page.keyboard.press('?')
      await expect(page.getByTestId('shortcuts-sheet')).toBeVisible()
      await settle(page, 30)
      await shoot(page, `m7-5-cheat-sheet-${suffix}`)
    })
  })
}

// 9. The cheat sheet and the Shortcuts tab at a small-tablet size (one column, the role table
// stacked); 1280×720 and 1024×768 are in block 8.
test.describe('m7.5 800x600-glacier', () => {
  test.use({ viewport: { width: 800, height: 600 } })

  test.beforeEach(async ({ page }) => {
    await seed(page, {})
    await page.goto('./#/')
    await expect(page.getByTestId('hud-bars')).toHaveText('64')
  })

  test('@visual m7.5 cheat sheet 800x600-glacier', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('shortcuts-sheet')).toBeVisible()
    await settle(page, 30)
    await shoot(page, 'm7-5-cheat-sheet-800x600-glacier')
    await page.getByTestId('list-roles').evaluate((el) => el.scrollIntoView({ block: 'end' }))
    await settle(page, 30)
    await shoot(page, 'm7-5-cheat-sheet-roles-800x600-glacier')
  })

  test('@visual m7.5 shortcuts tab 800x600-glacier', async ({ page }) => {
    await page.getByTestId('menu-settings').click()
    await page.getByTestId('tab-shortcuts').click()
    await expect(page.getByTestId('shortcut-playPause')).toBeVisible()
    await settle(page, 30)
    await shoot(page, 'm7-5-shortcuts-800x600-glacier')
  })
})

// 10. Milestone 7.6: the loop popover's "Back to" with the longest automatic name (it wraps
// under "Back to", dim, at most two lines).
for (const viewport of M6_VIEWPORTS) {
  const suffix = `${viewport.width}x${viewport.height}-glacier`

  test.describe(`m7.6 long name ${suffix}`, () => {
    test.use({ viewport })

    test(`@visual m7.6 loop popover long name ${suffix}`, async ({ page }) => {
      const name = 'Bars 100–120 · 85% · left only · quiet pre-roll 4 · metronome in pre-roll'
      const base = seedBookmark('long', name, { startBar: 100, endBar: 120 }) as {
        config: object
      }
      await seed(page, {})
      await page.goto('./#/')
      await expect(page.getByTestId('hud-bars')).not.toHaveText('')
      await seedPractice(page, {
        bookmarks: [
          {
            ...base,
            songId: SONG_IDS.canon,
            autoName: true,
            config: {
              ...base.config,
              tempoPercent: 85,
              handAudio: { right: 'muted', left: 'solo' },
              preRollBeats: 4,
              preRollMode: 'quiet',
              metronomeMode: 'preRoll',
            },
          },
        ],
        appState: [
          {
            key: 'lastOpened:default',
            value: JSON.stringify({ songId: SONG_IDS.canon, bookmarkId: 'long' }),
          },
        ],
      })
      await expect(page.getByTestId('hud-bookmark')).toHaveText(name)
      await page.keyboard.press('-')
      await page.getByTestId('open-loop').click()
      await expect(page.getByTestId('back-to-name')).toHaveText(name)
      await settle(page, 30)
      await shoot(page, `m7-6-loop-popover-long-name-${suffix}`)
    })
  })
}

// 11. Milestone 7.7: Welcome (with history, and empty) and the stats page (30 days, all songs;
// 12 months, one song), at the milestone 7 fixed time. Compare with
// docs/design/m7-7/source/QGWelcomeA and QGStats.
for (const viewport of M6_VIEWPORTS) {
  for (const theme of M6_THEMES) {
    const suffix = `${viewport.width}x${viewport.height}-${theme.name}`

    test.describe(`m7.7 ${suffix}`, () => {
      test.use({ viewport })

      test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(M7_NOW)
        await page.addInitScript(() => {
          localStorage.setItem(
            'pianomeister.ui',
            JSON.stringify({ sidebarOpen: false, sidebarSections: ['keyboard'] }),
          )
        })
        await seed(page, { appearance: theme.appearance })
        await page.goto('./#/')
        await expect(page.getByTestId('hud-bars')).toHaveText('64')
      })

      /** The two-week history, the profile named Matt, the B section stopped at bar 26. */
      async function seedMatt(page: Page): Promise<void> {
        const history = practiceHistory(M7_NOW.getTime()) as Parameters<typeof seedPractice>[1]
        await seedPractice(page, {
          ...history,
          profiles: [
            ...(history.profiles ?? []),
            { id: 'default', name: 'Matt', color: '#8AB4FF', createdAt: 0 },
          ],
          appState: [
            {
              key: 'lastOpened:default',
              value: JSON.stringify({ songId: SONG_IDS.minuet, bookmarkId: 'bm-b', bar: 26 }),
            },
          ],
        })
      }

      test(`@visual m7.7 welcome ${suffix}`, async ({ page }) => {
        await seedMatt(page)
        await page.goto('./')
        await expect(page.getByTestId('greeting')).toContainText('Matt')
        await expect(page.getByTestId('resume-details')).toContainText('stopped at bar 26')
        await settle(page, 30)
        await shoot(page, `m7-7-welcome-${suffix}`)
      })

      test(`@visual m7.7 welcome empty ${suffix}`, async ({ page }) => {
        await page.goto('./')
        await expect(page.getByTestId('resume-empty')).toBeVisible()
        await settle(page, 30)
        await shoot(page, `m7-7-welcome-empty-${suffix}`)
      })

      test(`@visual m7.7 stats ${suffix}`, async ({ page }) => {
        await seedMatt(page)
        await page.goto('./#/stats')
        await expect(page.getByTestId('stats-title')).toHaveText('Stats · Matt')
        await settle(page, 30)
        await shoot(page, `m7-7-stats-30-days-${suffix}`)

        await page.getByTestId('stats-range').getByText('12 months', { exact: true }).click()
        await choose(page, page.getByTestId('stats-song'), 'Minuet in G')
        await expect(page.getByTestId('top-card')).toContainText('Top bookmarks')
        await settle(page, 30)
        await shoot(page, `m7-7-stats-12-months-minuet-${suffix}`)
      })
    })
  }
}

// 12. Milestone 8: the overview strip (whole song with the bookmark lane in two rows; zoomed in
// with a selection and its action bar) and the loop editor (32 bars, a bookmark selected), at
// the milestone 7 fixed time with the B section loaded. Compare with
// docs/design/m8/source/QGOverviewA and QGOverviewB.
for (const viewport of M6_VIEWPORTS) {
  for (const theme of M6_THEMES) {
    const suffix = `${viewport.width}x${viewport.height}-${theme.name}`

    test.describe(`m8 ${suffix}`, () => {
      test.use({ viewport })

      test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(M7_NOW)
        await page.addInitScript(() => {
          localStorage.setItem(
            'pianomeister.ui',
            JSON.stringify({
              sidebarOpen: false,
              sidebarSections: ['keyboard'],
              overviewOpen: true,
            }),
          )
        })
        await seed(page, { appearance: theme.appearance })
        await page.goto('./#/')
        await expect(page.getByTestId('hud-bars')).toHaveText('64')
        const history = practiceHistory(M7_NOW.getTime()) as Parameters<typeof seedPractice>[1]
        await seedPractice(page, {
          ...history,
          bookmarks: [
            ...(history.bookmarks ?? []),
            {
              id: 'bm-phrase',
              profileId: 'default',
              songId: SONG_IDS.minuet,
              name: 'Opening phrase',
              autoName: false,
              config: {
                loop: { startBar: 5, endBar: 12 },
                tempoPercent: 100,
                handAudio: { right: 'on', left: 'on' },
                preRollBeats: 0,
                preRollMode: 'muted',
                metronomeMode: 'off',
              },
              createdAt: 5,
              updatedAt: 5,
            },
          ],
          appState: [
            {
              key: 'lastOpened:default',
              value: JSON.stringify({ songId: SONG_IDS.minuet, bookmarkId: 'bm-b', bar: 26 }),
            },
          ],
        })
        await expect(page.getByTestId('hud-bookmark')).toHaveText('B section')
      })

      test(`@visual m8 strip ${suffix}`, async ({ page }) => {
        const strip = page.getByTestId('overview-strip')
        await expect(strip.getByTestId('lane-item')).toHaveCount(4)
        await settle(page, 30)
        await shoot(page, `m8-strip-whole-${suffix}`)

        await page.getByTestId('overview-zoom').fill('0.45')
        const box = await strip.getByTestId('roll').boundingBox()
        expect(box).not.toBeNull()
        const y = (box?.y ?? 0) + 120
        await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.55, y)
        await page.mouse.down()
        await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.72, y, { steps: 6 })
        await page.mouse.up()
        await expect(page.getByTestId('selection-actions')).toBeVisible()
        await settle(page, 30)
        await shoot(page, `m8-strip-zoomed-selection-${suffix}`)
      })

      test(`@visual m8 editor ${suffix}`, async ({ page }) => {
        await page.goto('./#/editor?bookmark=bm-b')
        await expect(page.getByTestId('editor-name')).toHaveText('B section')
        // 32 bars from bar 1 (the mockup shows 9–40): the B section's lane and loop in view.
        await page.getByTestId('editor-zoom').locator('[data-value="32"]').click()
        await expect(page.getByTestId('editor-zoom').locator('[data-value="32"]')).toHaveAttribute(
          'data-state',
          'on',
        )
        await settle(page, 30)
        await shoot(page, `m8-editor-32-bars-${suffix}`)
      })
    })
  }
}

// Milestone 9: a fixed frame of the pedal demo — paused mid-chord on bar 2 with the sustain
// pedal down — with the animation clock pinned (?animTime), so flicker and noise render the
// same every run. "Classic + Off" is the milestone 8 look (compare with pedal-demo-bar2 of an
// m8 run); every other shot changes one thing over the provisional defaults.
const M9_FIXED = './#/?animTime=3'
const CLASSIC = {
  colors: { background: '#05070F', highway: '#0A0F1E' },
  highway: { vignette: 0 },
  lines: { nowStyle: 'thin', nowGlow: 0, borders: false },
  noteStyle: { edgeGlow: false },
  effects: { pulse: false, soundingGlow: false, keySpill: false },
  render: { bloomStrength: 0 },
}
const QUALITY = {
  off: { quality: 'off', bloomResolution: 'off', particleBudget: 512, shaderDetail: 'minimal' },
  low: { quality: 'low', bloomResolution: 'quarter', particleBudget: 1024, shaderDetail: 'low' },
  medium: {
    quality: 'medium',
    bloomResolution: 'half',
    particleBudget: 2048,
    shaderDetail: 'medium',
  },
  high: { quality: 'high', bloomResolution: 'full', particleBudget: 4096, shaderDetail: 'high' },
} as const

async function seed6(page: Page, settings: Settings) {
  await page.addInitScript(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({ version: 6, settings }),
  )
}

async function m9Frame(page: Page, settings: Settings, name: string) {
  await seed6(page, settings)
  await openUpload(page, PEDAL_DEMO, 'Pedal demo')
  await page.goto(M9_FIXED)
  await page.reload()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')
  await page.getByRole('button', { name: 'Next bar' }).click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('2:1')
  await settle(page, 30)
  await shoot(page, name)
}

const M9_SHOTS: readonly { readonly name: string; readonly settings: Settings }[] = [
  { name: 'classic-off', settings: { ...CLASSIC, render: { ...CLASSIC.render, ...QUALITY.off } } },
  { name: 'defaults', settings: {} },
  {
    name: 'effects-off',
    settings: {
      ...CLASSIC,
      effects: { ...CLASSIC.effects, enabled: false },
    },
  },
  ...(
    [
      'solid',
      'gradient',
      'hotCore',
      'outline',
      'neon',
      'stripes',
      'smoke',
      'crystal',
      'bubbles',
      'liquid',
    ] as const
  ).map((fill) => ({
    name: `fill-${fill}`,
    settings: { noteStyle: { headFill: fill, sustainFill: fill } },
  })),
  ...(['thin', 'glowing', 'neon'] as const).map((style) => ({
    name: `now-${style}`,
    settings: { lines: { nowStyle: style, nowGlow: 1 } },
  })),
  {
    name: 'now-neon-pitch',
    settings: { lines: { nowStyle: 'neon', nowColor: 'pitch', nowGlow: 1.2 } },
  },
  {
    name: 'lines-octaves-borders',
    settings: {
      lines: { borders: true, bordersGlow: 1, octaves: true, octavesEF: true, octavesGlow: 0.8 },
    },
  },
  { name: 'pedal-default', settings: {} },
  {
    name: 'pedal-border-stripes',
    settings: {
      pedal: {
        fill: 'stripes',
        fillOpacity: 0.3,
        border: true,
        borderColor: 'primary',
        borderGlow: 1.2,
        cornerRadius: 0.3,
      },
    },
  },
  {
    name: 'pedal-smoke',
    settings: {
      pedal: { fill: 'smoke', fillOpacity: 0.35, border: true, borderColor: 'secondary' },
    },
  },
  ...(['notes', 'keys', 'both'] as const).map((mode) => ({
    name: `names-${mode}`,
    settings: { names: { mode, octave: 'all' }, highway: { lookAheadBeats: 4 } },
  })),
  {
    name: 'key-light',
    settings: {
      effects: { keySpillStrength: 0.6, keyCone: true, keyConeStrength: 0.8 },
      render: QUALITY.high,
    },
  },
  ...(['off', 'low', 'medium', 'high'] as const).map((q) => ({
    name: `quality-${q}`,
    settings: { render: QUALITY[q] },
  })),
]

test.describe('m9 1280x720', () => {
  test.use({ viewport: { width: 1280, height: 720 } })
  for (const shot of M9_SHOTS) {
    test(`@visual m9 ${shot.name} 1280x720`, async ({ page }) => {
      await m9Frame(page, shot.settings, `m9-${shot.name}-1280x720`)
      await expect(page.getByTestId('hud-title')).toHaveText('Pedal demo')
    })
  }
})

test.describe('m9 1024x768', () => {
  test.use({ viewport: { width: 1024, height: 768 } })
  for (const name of ['defaults', 'now-neon-pitch', 'names-both', 'quality-high']) {
    const shot = M9_SHOTS.find((s) => s.name === name)
    if (shot === undefined) continue

    test(`@visual m9 ${shot.name} 1024x768`, async ({ page }) => {
      await m9Frame(page, shot.settings, `m9-${shot.name}-1024x768`)
      await expect(page.getByTestId('hud-title')).toHaveText('Pedal demo')
    })
  }
})
