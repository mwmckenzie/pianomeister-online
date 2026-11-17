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
