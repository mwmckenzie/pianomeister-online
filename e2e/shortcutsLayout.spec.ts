import { type Locator, type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { watchErrors } from './support'

/**
 * The cheat sheet and Settings → Shortcuts never scroll sideways, and no key chip is clipped or
 * pushed out of its row, at desktop, small-laptop and small-tablet sizes.
 */

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 800, height: 600 },
] as const

/** The dialog and every scroll container in it: content no wider than the box. */
async function expectNoHorizontalOverflow(dialog: Locator): Promise<void> {
  const overflowing = await dialog.evaluate((root) => {
    const boxes = [root, ...root.querySelectorAll<HTMLElement>('*')].filter(
      (el) => el === root || ['auto', 'scroll'].includes(getComputedStyle(el).overflowY),
    )
    return boxes
      .filter((el) => el.scrollWidth > el.clientWidth)
      .map((el) => `${el.className || el.tagName}: ${el.scrollWidth} > ${el.clientWidth}`)
  })
  expect(overflowing).toEqual([])
}

/** Every chip (`chipSelector`) lies wholly inside its row (`rowSelector`). */
async function expectChipsInsideRows(
  dialog: Locator,
  rowSelector: string,
  chipSelector: string,
): Promise<void> {
  const outside = await dialog.evaluate(
    (root, [rows, chips]) => {
      const problems: string[] = []
      for (const row of root.querySelectorAll<HTMLElement>(rows)) {
        const r = row.getBoundingClientRect()
        for (const chip of row.querySelectorAll<HTMLElement>(chips)) {
          const c = chip.getBoundingClientRect()
          const inside =
            c.left >= r.left - 0.5 &&
            c.right <= r.right + 0.5 &&
            c.top >= r.top - 0.5 &&
            c.bottom <= r.bottom + 0.5
          if (!inside)
            problems.push(`${row.dataset.command ?? row.dataset.testid}: ${chip.textContent}`)
        }
      }
      return problems
    },
    [rowSelector, chipSelector] as const,
  )
  expect(outside).toEqual([])
}

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
}

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width}×${viewport.height}`

  test.describe(size, () => {
    test.use({ viewport })

    test(`the cheat sheet fits without horizontal scrolling at ${size}`, async ({ page }) => {
      const errors = watchErrors(page)
      await openPlayer(page)
      await page.keyboard.press('?')
      const sheet = page.getByTestId('shortcuts-sheet')
      await expect(sheet).toBeVisible()
      await expect(sheet.getByTestId('sheet-row').first()).toBeVisible()
      await expectNoHorizontalOverflow(sheet)
      await expectChipsInsideRows(sheet, '[data-testid="sheet-row"]', '[data-testid="sheet-key"]')
      // The role table has its own section at the bottom, outside the Lists group.
      await expect(sheet.getByTestId('list-roles')).toHaveCount(1)
      await expect(sheet.getByTestId('sheet-group-lists').getByTestId('list-roles')).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test(`Settings → Shortcuts fits without horizontal scrolling at ${size}`, async ({ page }) => {
      const errors = watchErrors(page)
      await openPlayer(page)
      await page.getByTestId('menu-settings').click()
      await page.getByTestId('tab-shortcuts').click()
      const window = page.getByTestId('settings-window')
      await expect(window.getByTestId('shortcut-playPause')).toBeVisible()
      // With two keys on a command too (Tempo up has + and =), and a second key added.
      await window.getByTestId('shortcut-stop').getByTestId('shortcut-add').click()
      await page.keyboard.press('Shift+End')
      await expect(window.getByTestId('shortcut-stop').getByTestId('shortcut-key')).toHaveCount(2)
      await expectNoHorizontalOverflow(window)
      await expectChipsInsideRows(
        window,
        '[data-testid^="shortcut-"][data-changed]',
        '[data-testid="shortcut-key"]',
      )
      expect(errors).toEqual([])
    })
  })
}
