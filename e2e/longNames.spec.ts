import { test, expect, type Locator, type Page } from '@playwright/test'

import { seedBookmark, seedPractice, SONG_IDS, watchErrors } from './support'

/**
 * The longest automatic bookmark name (brief decision 76) never overflows the surface it's shown
 * on: it wraps, or truncates with the full name in a tooltip.
 */

const LONG = 'Bars 100–120 · 85% · left only · quiet pre-roll 4 · metronome in pre-roll'

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
] as const

/** The Canon (102 bars): the range is clamped to 100–102 when loaded, the name stays. */
function longBookmark(): object {
  const base = seedBookmark('long', LONG, { startBar: 100, endBar: 120 }, { autoName: true }) as {
    config: object
  }
  return {
    ...base,
    songId: SONG_IDS.canon,
    config: {
      ...base.config,
      tempoPercent: 85,
      handAudio: { right: 'muted', left: 'solo' },
      preRollBeats: 4,
      preRollMode: 'quiet',
      metronomeMode: 'preRoll',
    },
  }
}

/**
 * Nothing inside `container` sticks out of it (elements clipped by an overflow-hidden ancestor
 * inside it are fine), no scroll container in it scrolls sideways, and any element showing the
 * long name cut short carries the full name in a tooltip.
 */
async function expectContained(container: Locator): Promise<void> {
  await expect(container).toBeVisible()
  const problems = await container.evaluate((root, long) => {
    const out: string[] = []
    const box = root.getBoundingClientRect()
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''}.${el.className}`
    const clipped = (el: Element): boolean => {
      for (let p = el.parentElement; p !== null && p !== root; p = p.parentElement) {
        const o = getComputedStyle(p)
        if (o.overflowX !== 'visible' || o.overflowY !== 'visible') return true
      }
      return false
    }
    for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
      const style = getComputedStyle(el)
      if (['auto', 'scroll'].includes(style.overflowX) || el === root) {
        if (el.scrollWidth > el.clientWidth + 1)
          out.push(`${name(el)} scrolls: ${el.scrollWidth} > ${el.clientWidth}`)
      }
      if (el === root || clipped(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.left < box.left - 1 || r.right > box.right + 1)
        out.push(
          `${name(el)} sticks out: ${Math.round(r.left)}–${Math.round(r.right)} of ${Math.round(box.left)}–${Math.round(box.right)}`,
        )
    }
    // Shown cut short: the full name must be in a tooltip.
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      const text = el.textContent ?? ''
      if (!text.includes(long.slice(0, 20)) || el.children.length > 0) continue
      const cut = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
      if (!cut) continue
      const titled = el.closest('[title]')?.getAttribute('title') ?? ''
      if (!titled.includes(long)) out.push(`${name(el)} is cut short without a tooltip`)
    }
    return out
  }, LONG)
  expect(problems).toEqual([])
}

async function openPlayer(page: Page, sidebar: boolean): Promise<void> {
  await page.addInitScript((open) => {
    localStorage.setItem(
      'pianomeister.ui',
      JSON.stringify({ sidebarOpen: open, sidebarSections: ['keyboard'] }),
    )
  }, sidebar)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).not.toHaveText('')
  await seedPractice(page, {
    bookmarks: [longBookmark()],
    profiles: [{ id: 'anna', name: 'Anna', color: '#FFB38A', createdAt: 10 }],
    appState: [
      {
        key: 'lastOpened:default',
        value: JSON.stringify({ songId: SONG_IDS.canon, bookmarkId: 'long' }),
      },
    ],
  })
  await expect(page.getByTestId('hud-bookmark')).toHaveText(LONG)
}

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width}×${viewport.height}`

  test.describe(size, () => {
    test.use({ viewport })

    test(`the player: HUD line (sidebar open), loop and tempo popovers, toasts at ${size}`, async ({
      page,
    }) => {
      const errors = watchErrors(page)
      await openPlayer(page, true)
      await expectContained(page.getByTestId('hud-left'))

      // A temporary change: "Back to <long name>" in the loop popover.
      await page.getByTestId('open-tempo').click()
      await expectContained(page.getByTestId('tempo-popover'))
      await page.getByTestId('tempo-slider').getByRole('slider').press('ArrowLeft')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('hud-custom')).toBeVisible()
      await expectContained(page.getByTestId('hud-left'))
      await page.getByTestId('open-loop').click()
      await expect(page.getByTestId('back-to-loaded')).toBeVisible()
      await expectContained(page.getByTestId('loop-popover'))
      await page.keyboard.press('Escape')

      // Saving it: "Saved …", then again: "Already saved as …".
      await page.getByTestId('save-bookmark-icon').click()
      const saved = page.getByTestId('toast').filter({ hasText: 'Saved' })
      await expect(saved).toBeVisible()
      await expectContained(saved)
      await page.getByTestId('save-bookmark-icon').click()
      const already = page.getByTestId('toast').filter({ hasText: 'Already saved as' })
      await expect(already).toBeVisible()
      await expectContained(already)
      expect(errors).toEqual([])
    })

    test(`the picker, bookmark manager and dialogs at ${size}`, async ({ page }) => {
      const errors = watchErrors(page)
      await openPlayer(page, false)

      await page.getByTestId('open-picker').click()
      await page.getByTestId('picker-song').filter({ hasText: 'Canon' }).click()
      await page.getByTestId('picker-bookmark').click()
      await expect(page.getByTestId('picker-entry-name')).toHaveText(LONG)
      await expectContained(page.getByTestId('song-picker'))
      await page.keyboard.press('Escape')

      await page.goto(`./#/bookmarks?song=${SONG_IDS.canon}`)
      await expect(page.getByTestId('bookmark-name')).toHaveValue(LONG)
      await expectContained(page.getByTestId('bookmark-manager'))
      // An unsaved duplicate, then another row: the discard dialog names the twin.
      await page.getByTestId('bookmark-duplicate').click()
      await page.getByTestId('filter-all').click()
      await expect(page.getByTestId('discard-duplicate')).toBeVisible()
      await expectContained(page.getByTestId('discard-duplicate'))
      // Discard it, so leaving the manager doesn't ask again.
      await page.getByTestId('discard-duplicate-confirm').click()

      // The profile delete confirm (two profiles).
      await page.goto('./#/')
      await page.getByTestId('menu-settings').click()
      await page.getByTestId('tab-profiles').click()
      await page.getByTestId('profile-delete').last().click()
      await expectContained(page.getByRole('dialog').last())
      await page.keyboard.press('Escape')

      // The cheat sheet.
      await page.keyboard.press('Escape')
      await page.keyboard.press('?')
      await expectContained(page.getByTestId('shortcuts-sheet'))
      expect(errors).toEqual([])
    })
  })
}
