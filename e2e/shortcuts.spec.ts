import { test, expect, type Page } from '@playwright/test'

import { seedBookmark, seedPractice, watchErrors } from './support'

const row = (page: Page, id: string) => page.getByTestId(`shortcut-${id}`)

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
}

async function openShortcutsTab(page: Page): Promise<void> {
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-shortcuts').click()
  await expect(row(page, 'playPause')).toBeVisible()
}

/** Clicks a command's chip (or "+" with index = number of keys) and presses `key`. */
async function record(page: Page, id: string, key: string, index = 0): Promise<void> {
  const r = row(page, id)
  const keys = await r.getByTestId('shortcut-key').count()
  if (index >= keys) await r.getByTestId('shortcut-add').click()
  else await r.getByTestId('shortcut-key').nth(index).click()
  await expect(r.getByTestId('shortcut-recording')).toBeFocused()
  await page.keyboard.press(key)
}

test('rebind Play/pause to K: K plays, Space no longer does; it persists; reset restores Space', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await openShortcutsTab(page)
  await expect(row(page, 'playPause').getByTestId('shortcut-key')).toHaveText(['Space'])
  await record(page, 'playPause', 'k')
  await expect(row(page, 'playPause').getByTestId('shortcut-key')).toHaveText(['K'])
  await expect(row(page, 'playPause')).toHaveAttribute('data-changed', 'true')
  await expect(page.getByTestId('changed-count')).toHaveText('1 shortcut changed from default')
  await expect(page.getByTestId('tab-shortcuts').getByLabel('has changed settings')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-window')).toBeHidden()

  await page.getByTestId('stage').click()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('transport-state')).not.toHaveText('playing')
  await page.keyboard.press('k')
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  await page.keyboard.press('K')
  await expect(page.getByTestId('transport-state')).toHaveText('paused')

  await page.reload()
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await openShortcutsTab(page)
  await expect(row(page, 'playPause').getByTestId('shortcut-key')).toHaveText(['K'])
  await row(page, 'playPause').getByTestId('shortcut-reset').click()
  await expect(row(page, 'playPause').getByTestId('shortcut-key')).toHaveText(['Space'])
  await expect(page.getByTestId('changed-count')).toHaveText('0 shortcuts changed from default')
  expect(errors).toEqual([])
})

test('a second key, removing keys, and a command with none', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openShortcutsTab(page)
  await record(page, 'stop', 'Shift+KeyS', 1)
  await expect(row(page, 'stop').getByTestId('shortcut-key')).toHaveText(['Home', 'S'])
  // Two keys: no "+".
  await expect(row(page, 'stop').getByTestId('shortcut-add')).toHaveCount(0)
  await row(page, 'stop').getByTestId('shortcut-key').first().hover()
  await row(page, 'stop').getByTestId('shortcut-remove').first().click()
  await expect(row(page, 'stop').getByTestId('shortcut-key')).toHaveText(['S'])
  await row(page, 'stop').getByTestId('shortcut-remove').first().click()
  await expect(row(page, 'stop').getByTestId('shortcut-none')).toHaveText('—')
  await expect(row(page, 'toggleLoop').getByTestId('shortcut-none')).toHaveText('—')
  // Esc closes is listed, fixed.
  await expect(row(page, 'closeDialog').getByTestId('shortcut-key')).toBeDisabled()
  await expect(row(page, 'closeDialog').getByTestId('shortcut-reset')).toHaveCount(0)
  // A Ctrl combo is a physical key.
  await record(page, 'toggleLoop', 'Control+Shift+KeyK')
  await expect(row(page, 'toggleLoop').getByTestId('shortcut-key')).toHaveText(['Ctrl+Shift+K'])
  await page.keyboard.press('Escape')
  // Home no longer stops; the loop key works.
  await page.keyboard.press('Control+Shift+KeyK')
  await expect(page.getByTestId('toggle-loop')).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('a key another command uses: Replace moves it, Cancel changes nothing', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openShortcutsTab(page)
  await record(page, 'playPause', 'm')
  await expect(row(page, 'playPause').getByTestId('shortcut-conflict')).toContainText(
    'Already used by Metronome',
  )
  // Nothing saved yet.
  await expect(row(page, 'playPause').getByTestId('shortcut-key')).toHaveText(['Space'])
  await row(page, 'playPause').getByTestId('shortcut-cancel').click()
  await expect(row(page, 'playPause').getByTestId('shortcut-conflict')).toBeHidden()
  await expect(row(page, 'toggleMetronome').getByTestId('shortcut-key')).toHaveText(['M'])

  await record(page, 'playPause', 'm')
  await row(page, 'playPause').getByTestId('shortcut-replace').click()
  await expect(row(page, 'playPause').getByTestId('shortcut-key')).toHaveText(['M'])
  await expect(row(page, 'toggleMetronome').getByTestId('shortcut-none')).toBeVisible()
  // "?" (everywhere) conflicts with a player key too.
  await record(page, 'stop', 'Shift+Slash')
  await expect(row(page, 'stop').getByTestId('shortcut-conflict')).toContainText(
    'Already used by Show shortcuts',
  )
  expect(errors).toEqual([])
})

test('reserved keys are refused; Esc cancels recording without closing settings', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openShortcutsTab(page)
  await record(page, 'nextBar', 'Control+KeyW')
  await expect(row(page, 'nextBar').getByTestId('shortcut-message')).toHaveText(
    'Ctrl+W is used by the browser',
  )
  await record(page, 'nextBar', 'Tab')
  await expect(row(page, 'nextBar').getByTestId('shortcut-message')).toHaveText('Tab moves focus')
  await record(page, 'nextBar', 'F5')
  await expect(row(page, 'nextBar').getByTestId('shortcut-message')).toHaveText(
    'F5 is used by the browser',
  )
  await expect(row(page, 'nextBar').getByTestId('shortcut-key')).toHaveText(['→'])

  // Esc while recording: the recording stops, the window stays.
  await row(page, 'nextBar').getByTestId('shortcut-key').click()
  await expect(row(page, 'nextBar').getByTestId('shortcut-recording')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(row(page, 'nextBar').getByTestId('shortcut-recording')).toHaveCount(0)
  await expect(page.getByTestId('settings-window')).toBeVisible()
  await expect(row(page, 'nextBar').getByTestId('shortcut-key')).toHaveText(['→'])
  // A modifier alone keeps waiting; leaving the chip stops.
  await row(page, 'nextBar').getByTestId('shortcut-key').click()
  await page.keyboard.press('Shift')
  await expect(row(page, 'nextBar').getByTestId('shortcut-recording')).toBeVisible()
  await page.getByTestId('tab-shortcuts').focus()
  await expect(row(page, 'nextBar').getByTestId('shortcut-recording')).toHaveCount(0)
  // Esc again closes as usual.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-window')).toBeHidden()
  expect(errors).toEqual([])
})

test('Reset all shortcuts, with Undo', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openShortcutsTab(page)
  await record(page, 'playPause', 'k')
  await record(page, 'openLibrary', 'j')
  await expect(page.getByTestId('changed-count')).toHaveText('2 shortcuts changed from default')
  await page.getByTestId('reset-tab-shortcuts').click()
  await expect(page.getByTestId('changed-count')).toHaveText('0 shortcuts changed from default')
  await expect(row(page, 'playPause').getByTestId('shortcut-key')).toHaveText(['Space'])
  await page.getByTestId('toast-undo').click()
  await expect(page.getByTestId('changed-count')).toHaveText('2 shortcuts changed from default')
  await expect(row(page, 'openLibrary').getByTestId('shortcut-key')).toHaveText(['J'])
  expect(errors).toEqual([])
})

test('tempo keys follow the tempo step and a bookmark’s temporary layer', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await page.getByTestId('stage').click()
  await page.keyboard.press('-')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('95%')
  await page.keyboard.press('+')
  await page.keyboard.press('=')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('105%')
  await page.keyboard.press('0')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('100%')

  // A 2% step.
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-practice').click()
  const step = page.getByTestId('setting-practice-tempoStep').getByRole('slider')
  await step.focus()
  for (let i = 0; i < 3; i++) await step.press('ArrowLeft')
  await page.keyboard.press('Escape')
  await page.keyboard.press('-')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('98%')

  // With a bookmark loaded the change is temporary: the line shows the setup; the bookmark keeps 100%.
  await seedPractice(page, {
    bookmarks: [seedBookmark('b1', 'Opening', { startBar: 1, endBar: 4 })],
  })
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await page.getByTestId('open-picker').click()
  await page.getByTestId('picker-song').filter({ hasText: 'Minuet' }).click()
  await page.getByTestId('picker-bookmark').click()
  await page.getByTestId('picker-load').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Opening')
  await page.getByTestId('stage').click()
  await page.keyboard.press('+')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('102%')
  await expect(page.getByTestId('hud-custom')).toHaveText(
    'Bars 1–4 · 102% · both hands · no pre-roll',
  )
  expect(errors).toEqual([])
})

test('? shows the shortcuts on the player, library and bookmark manager', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await page.keyboard.press('?')
  const sheet = page.getByTestId('shortcuts-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
  await expect(sheet.locator('[data-command="playPause"]')).toContainText('Space')
  await expect(sheet.locator('[data-command="toggleLoop"]')).toContainText('—')
  // Its own key closes it, and so does Esc.
  await page.keyboard.press('?')
  await expect(sheet).toBeHidden()
  await page.getByTestId('menu-shortcuts').click()
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // Not while another dialog is open, nor while typing.
  await page.getByTestId('open-picker').click()
  await page.getByTestId('picker-search').focus()
  await page.keyboard.press('?')
  await expect(sheet).toBeHidden()
  await expect(page.getByTestId('picker-search')).toHaveValue('?')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('song-picker')).toBeHidden()

  // On the library and the bookmark manager too; "Change shortcuts…" goes to the tab.
  await page.getByTestId('menu-library').click()
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  await page.keyboard.press('?')
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('tab-bookmarks').click()
  await expect(page.getByTestId('bookmark-manager')).toBeVisible()
  await page.keyboard.press('?')
  await expect(sheet).toBeVisible()
  await page.getByTestId('sheet-change').click()
  await expect(page.getByTestId('settings-window')).toBeVisible()
  await expect(row(page, 'showShortcuts')).toBeVisible()
  expect(errors).toEqual([])
})

test('hints and tooltips show the new key; a rebound list key still types in search', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openShortcutsTab(page)
  await record(page, 'openPicker', 'j')
  await record(page, 'playPause', 'Control+KeyK')
  await record(page, 'listNext', 'n')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('open-picker')).toHaveAttribute('aria-label', 'Change song (J)')
  await page.getByTestId('play-pause').hover()
  await expect(page.getByRole('tooltip')).toContainText('Ctrl+K')

  // The picker opens with J; "n" in its search is text, not Next in list.
  await page.getByTestId('stage').click()
  await page.keyboard.press('j')
  await expect(page.getByTestId('song-picker')).toBeVisible()
  const selected = await page
    .locator('[data-testid="picker-song"][aria-selected="true"]')
    .textContent()
  await page.getByTestId('picker-search').fill('')
  await page.getByTestId('picker-search').pressSequentially('min')
  await expect(page.getByTestId('picker-search')).toHaveValue('min')
  await page.getByTestId('picker-search').fill('')
  await expect(page.locator('[data-testid="picker-song"][aria-selected="true"]')).toHaveText(
    selected ?? '',
  )
  expect(errors).toEqual([])
})

test('↑/↓ move through the bookmark manager list', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await seedPractice(page, {
    bookmarks: [
      seedBookmark('a', 'Opening', { startBar: 1, endBar: 4 }),
      seedBookmark('b', 'Middle', { startBar: 17, endBar: 32 }),
      seedBookmark('c', 'Ending', { startBar: 61, endBar: 64 }),
    ],
  })
  await page.goto('./#/bookmarks')
  await page.getByTestId('bookmark-row').filter({ hasText: 'Opening' }).click()
  await expect(page.getByTestId('bookmark-name')).toHaveValue('Opening')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('bookmark-name')).toHaveValue('Middle')
  await expect(page.getByTestId('bookmark-row').filter({ hasText: 'Middle' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('bookmark-name')).toHaveValue('Ending')
  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('bookmark-name')).toHaveValue('Middle')
  expect(errors).toEqual([])
})
