import { expect, type Locator, type Page } from '@playwright/test'

/** Collects console errors and page errors for the whole test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

/** The row of a registry setting, e.g. `setting(page, 'camera.tiltDeg')`. */
export const setting = (page: Page, key: string): Locator =>
  page.getByTestId(`setting-${key.replace('.', '-')}`)

/** A setting's slider thumb (role=slider, aria-valuenow is the stored value). */
export const thumb = (page: Page, key: string): Locator => setting(page, key).getByRole('slider')

/** The shown value of a number setting, e.g. "45°" or "12 mm". */
export const shownValue = (page: Page, key: string): Locator =>
  page.getByTestId(`setting-${key.replace('.', '-')}-value`)

export const resetButton = (page: Page, key: string): Locator =>
  page.getByTestId(`setting-${key.replace('.', '-')}-reset`)

/** Presses a key on a slider thumb `times` times (Arrow keys step, Home/End jump). */
export async function nudge(page: Page, key: string, press: string, times = 1): Promise<void> {
  const handle = thumb(page, key)
  await handle.focus()
  for (let i = 0; i < times; i++) await handle.press(press)
}

/** Picks an option in a Reka select (the trigger carries the test id). */
export async function choose(page: Page, trigger: Locator, option: string): Promise<void> {
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await expect(trigger).toContainText(option)
}

/** Clicks one option of a segmented setting. */
export async function segment(page: Page, key: string, label: string): Promise<void> {
  await page
    .getByTestId(`setting-${key.replace('.', '-')}-control`)
    .getByText(label, { exact: true })
    .click()
}

/** Opens the playfield sidebar and expands one of its sections. */
export async function openSidebarSection(page: Page, section: string): Promise<void> {
  if (!(await page.getByTestId('playfield-sidebar').isVisible())) {
    await page.getByTestId('toggle-sidebar').click()
  }
  const trigger = page.getByTestId(`accordion-${section}`)
  if ((await trigger.getAttribute('data-state')) !== 'open') await trigger.click()
}

/** Bundled song ids (content hashes, from public/songs/manifest.json). */
export const SONG_IDS = {
  minuet: '23a649ebc53696bc6ce551246cc0ef74ee99f1e1fa964d55a2997999527485ca',
  canon: 'a4988dba91c83291e4016da87d19c03bd4ecf0087a186605d8615dd2e241bbb7',
  invention: '6fec24e88f82fd8c2aea348ac027c3baccf2cb18bc24b362176facc3d6410b9d',
} as const

/** Rows to write straight into IndexedDB (test-only: the app never seeds data). */
export interface PracticeSeed {
  readonly profiles?: readonly object[]
  readonly bookmarks?: readonly object[]
  readonly sessions?: readonly object[]
  readonly playRecords?: readonly object[]
  readonly appState?: readonly object[]
  readonly playlists?: readonly object[]
}

/**
 * Writes practice data into the app's database, then reloads so the app reads it. The page
 * must already have opened the app once (the database exists at the current version).
 */
export async function seedPractice(page: Page, seed: PracticeSeed): Promise<void> {
  await page.evaluate(
    (data) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('pianomeister')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const stores = Object.keys(data).filter(
            (name) => (data as Record<string, unknown[]>)[name]?.length,
          )
          if (stores.length === 0) {
            db.close()
            resolve()
            return
          }
          const tx = db.transaction(stores, 'readwrite')
          for (const name of stores) {
            for (const row of (data as Record<string, unknown[]>)[name] ?? []) {
              tx.objectStore(name).put(row)
            }
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    seed,
  )
  await page.reload()
}

/** Reads a whole object store (e.g. 'playRecords'), for checks against what the UI shows. */
export async function readStore<T>(page: Page, name: string): Promise<T[]> {
  return page.evaluate(
    (store) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('pianomeister')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const request = db.transaction(store, 'readonly').objectStore(store).getAll()
          request.onsuccess = () => {
            db.close()
            resolve(request.result as T[])
          }
          request.onerror = () => reject(request.error)
        }
      }),
    name,
  )
}

/** Sets the loop in the open player to bars `from`–`to` (and turns it on). */
export async function setLoopBars(page: Page, from: number, to: number): Promise<void> {
  await page.getByTestId('open-loop').click()
  await page.getByTestId('loop-from').fill(String(from))
  await page.getByTestId('loop-from').press('Enter')
  await page.getByTestId('loop-to').fill(String(to))
  await page.getByTestId('loop-to').press('Enter')
  const set = page.getByTestId('loop-set')
  if (await set.isEnabled()) await set.click()
}

/**
 * "Save as bookmark": the loop popover's button when it's open, else the HUD icon. One click,
 * auto-named (brief decision 69); resolves to the name the HUD then shows.
 */
export async function saveAsBookmark(page: Page): Promise<string> {
  const inPopover = page.getByTestId('save-bookmark')
  if (await inPopover.isVisible()) await inPopover.click()
  else await page.getByTestId('save-bookmark-icon').click()
  await expect(page.getByTestId('toast').filter({ hasText: /^Saved “/ })).toBeVisible()
  const name = page.getByTestId('hud-bookmark')
  await expect(name).toBeVisible()
  return (await name.textContent()) ?? ''
}

/** A stored bookmark for seedPractice: the Minuet, both hands, no pre-roll. */
export function seedBookmark(
  id: string,
  name: string,
  loop: { readonly startBar: number; readonly endBar: number },
  extra: { readonly autoName?: boolean; readonly tempoPercent?: number } = {},
): object {
  return {
    id,
    profileId: 'default',
    songId: SONG_IDS.minuet,
    name,
    autoName: extra.autoName ?? false,
    config: {
      loop,
      tempoPercent: extra.tempoPercent ?? 100,
      handAudio: { right: 'on', left: 'on' },
      preRollBeats: 0,
      preRollMode: 'muted',
      metronomeMode: 'off',
    },
    createdAt: 1,
    updatedAt: 1,
  }
}

/**
 * No stored state: for tests that seed their own stored settings (the functional project
 * otherwise starts with render quality Off, see playwright.config.ts).
 */
export const EMPTY_STORAGE = { cookies: [], origins: [] }

/**
 * Local midday `days` calendar days before `now`: a seed that a day label reads ("3 days",
 * "Yesterday") stays on its day whatever the hour the test runs.
 */
export function middayDaysAgo(days: number, now = Date.now()): number {
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d.getTime()
}

/**
 * A moment earlier today: halfway between local midnight and `now`, so "today" seeds stay today
 * even just after midnight (an hour ago can be yesterday).
 */
export function earlierToday(now = Date.now()): number {
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  return midnight.getTime() + Math.floor((now - midnight.getTime()) / 2)
}
