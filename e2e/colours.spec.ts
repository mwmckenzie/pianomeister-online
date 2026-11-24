import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { choose, openSidebarSection, watchErrors } from './support'

/**
 * Milestone 10.6: the note colour set editor (Settings → Appearance → Note colours). The highway
 * is checked through the engine's twelve colours (`?stats=1`).
 */
const noteColors = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { pianomeisterNoteColors: () => string[] | null }
    ).pianomeisterNoteColors(),
  )

const palette = (page: Page) => page.getByTestId('setting-notes-palette-control')
const key = (page: Page, pc: number) => page.getByTestId(`colour-key-${pc}`)
const hex = (page: Page) => page.getByTestId('colour-field').locator('.hex')

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/?stats=1')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await openSidebarSection(page, 'notes')
}

/** From the sidebar, with the playfield's set selected. */
async function openEditor(page: Page): Promise<void> {
  await page.getByTestId('edit-colours').click()
  await expect(page.getByTestId('colour-editor')).toBeVisible()
}

async function closeSettings(page: Page): Promise<void> {
  await page.getByTestId('close-settings').click()
  await expect(page.getByTestId('settings-window')).toBeHidden()
}

async function setHex(page: Page, pc: number, value: string): Promise<void> {
  await key(page, pc).click()
  await hex(page).fill(value)
  await hex(page).press('Enter')
}

async function saveLook(page: Page, name: string): Promise<void> {
  await page.getByTestId('look-save-new').click()
  await page.getByTestId('look-name').fill(name)
  await page.getByTestId('look-name-save').click()
  await expect(page.getByTestId('look-select')).toContainText(name)
}

test('@colours @smoke a changed built-in colour shows at once, survives a reload and resets', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  const original = await noteColors(page)
  await openEditor(page)
  await expect(page.getByTestId('colour-count')).toHaveText('Original colours')
  await expect(page.getByTestId('save-as-colour-set')).toBeHidden()

  // Not a colour: reverts.
  await setHex(page, 0, 'red')
  await expect(hex(page)).toHaveValue('#FF0000')
  await setHex(page, 0, '12ab34')
  await expect(key(page, 0)).toHaveAttribute('data-colour', '#12AB34')
  await expect(key(page, 0)).toHaveAttribute('data-modified', 'true')
  await expect(page.getByTestId('colour-set-default')).toContainText('Default · modified')
  await expect(page.getByTestId('colour-was')).toHaveText('modified · was #ff0000')
  await expect(page.getByTestId('colour-count')).toHaveText('1 colour changed from the original')
  expect(await noteColors(page)).toEqual(['#12AB34', ...(original ?? []).slice(1)])

  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(palette(page)).toContainText('Default · modified')
  expect((await noteColors(page))?.[0]).toBe('#12AB34')

  await openEditor(page)
  await page.getByTestId('reset-colour').click()
  await expect(page.getByTestId('colour-count')).toHaveText('Original colours')
  await expect(page.getByTestId('reset-colour')).toBeDisabled()
  expect(await noteColors(page)).toEqual(original)

  // The original colour, typed, is no change either.
  await setHex(page, 2, '#000000')
  await expect(page.getByTestId('colour-count')).toContainText('1 colour')
  await setHex(page, 2, '#ffe500')
  await expect(page.getByTestId('colour-count')).toHaveText('Original colours')
  expect(errors).toEqual([])
})

test('@colours the piano roll follows an edited set', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await page.getByTestId('overview-toggle').click()
  const roll = page.getByTestId('overview-strip').getByTestId('roll')
  await expect(roll).toBeVisible()
  const before = await roll.screenshot()
  await openEditor(page)
  for (const pc of [2, 7]) await setHex(page, pc, '#FFFFFF')
  await closeSettings(page)
  await expect.poll(async () => (await roll.screenshot()).equals(before)).toBe(false)
  await openEditor(page)
  await page.getByTestId('reset-colour-set').click()
  await closeSettings(page)
  await expect.poll(async () => (await roll.screenshot()).equals(before)).toBe(true)
  expect(errors).toEqual([])
})

test('@colours a look keeps the colours of a deleted set, as they were then', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openEditor(page)
  await page.getByTestId('new-colour-set').click()
  const name = page.getByTestId('colour-set-name')
  await expect(name).toHaveValue('Default copy')
  await expect(name).toBeFocused()
  await name.fill('Recital')
  await name.press('Enter')
  await expect(page.getByRole('button', { name: 'Recital' })).toBeVisible()
  // An empty name reverts; a taken one is refused.
  await name.fill('')
  await name.press('Enter')
  await expect(name).toHaveValue('Recital')
  await name.fill('neon')
  await name.press('Enter')
  await expect(name).toHaveValue('Recital')
  await setHex(page, 0, '#010203')
  await closeSettings(page)

  await choose(page, palette(page), 'Recital')
  await saveLook(page, 'My recital')
  // Edited after the look was saved: the look shows it, and keeps it when the set goes.
  await openEditor(page)
  await setHex(page, 1, '#040506')
  await expect.poll(async () => (await noteColors(page))?.[1]).toBe('#040506')
  await page.getByTestId('delete-colour-set').click()
  await expect(page.getByTestId('delete-colour-set-dialog')).toContainText('Delete Recital?')
  await page.getByTestId('delete-colour-set-confirm').click()
  await expect(page.getByTestId('colour-set-default')).toHaveAttribute('aria-pressed', 'true')
  await closeSettings(page)
  await expect(palette(page)).toContainText('Recital (saved in look)')
  await expect(page.getByTestId('look-status')).toBeHidden()

  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await choose(page, page.getByTestId('look-select'), 'Classic')
  expect((await noteColors(page))?.[0]).toBe('#FF0000')
  await choose(page, page.getByTestId('look-select'), 'My recital')
  await expect(palette(page)).toContainText('Recital (saved in look)')
  expect((await noteColors(page))?.slice(0, 2)).toEqual(['#010203', '#040506'])

  // Back as a set: the same look uses it again.
  await page.getByTestId('save-colour-set').click()
  await expect(palette(page)).toHaveText('Recital')
  await expect(page.getByTestId('look-status')).toBeHidden()
  await openEditor(page)
  await expect(page.getByTestId('colour-set-name')).toHaveValue('Recital')
  await setHex(page, 0, '#070809')
  expect((await noteColors(page))?.[0]).toBe('#070809')
  expect(errors).toEqual([])
})

test('@colours the warning shows for changed and own sets only, never for equal colours', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openEditor(page)
  const warning = page.getByTestId('colour-warning')
  // Warm's E and F are close as shipped.
  await page.getByTestId('colour-set-warm').click()
  await expect(page.getByTestId('colour-set-name')).toHaveValue('Warm')
  await expect(warning).toBeHidden()
  await setHex(page, 9, '#000000')
  await expect(warning).toContainText('Hard to tell apart: E and F.')
  await page.getByTestId('colour-set-mono').click()
  await setHex(page, 0, '#000000')
  await expect(page.getByTestId('colour-count')).toContainText('1 colour')
  await expect(warning).toBeHidden()

  // Save as new set keeps the original and warns there too.
  await page.getByTestId('colour-set-warm').click()
  await page.getByTestId('save-as-colour-set').click()
  await page.getByTestId('save-as-name').fill('Warmer')
  await page.getByTestId('save-as-confirm').click()
  await expect(page.getByTestId('colour-set-name')).toHaveValue('Warmer')
  await expect(warning).toContainText('E and F')
  await expect(page.getByTestId('colour-preview-text')).toContainText('stores its colours')
  expect(errors).toEqual([])
})

test('@colours the Appearance reset clears changes, with Undo, and keeps own sets', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openEditor(page)
  await setHex(page, 0, '#123456')
  await page.getByTestId('duplicate-colour-set').click()
  await expect(page.getByTestId('colour-set-name')).toHaveValue('Default copy')
  await page.getByTestId('colour-editor-back').click()
  // The changed set, and the setting every functional test starts with (playwright.config).
  await expect(page.getByTestId('changed-count')).toHaveText('2 settings changed from default')
  await page.getByTestId('reset-tab-appearance').click()
  await expect(page.getByTestId('changed-count')).toHaveText('0 settings changed from default')
  expect((await noteColors(page))?.[0]).toBe('#FF0000')
  await expect(page.getByTestId('section-noteColours')).toContainText('Default copy')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await noteColors(page))?.[0]).toBe('#123456')
  expect(errors).toEqual([])
})

test('@colours keys work from the keyboard and Esc closes the window', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openEditor(page)
  await key(page, 0).focus()
  await page.keyboard.press('ArrowRight')
  await expect(key(page, 1)).toBeFocused()
  await expect(key(page, 1)).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(key(page, 11)).toBeFocused()
  await page.keyboard.press('Home')
  await expect(key(page, 0)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-window')).toBeHidden()
  // Opened again, Settings starts outside the editor.
  await page.getByTestId('open-all-settings').click()
  await expect(page.getByTestId('settings-window')).toBeVisible()
  await expect(page.getByTestId('colour-editor')).toBeHidden()
  expect(errors).toEqual([])
})
