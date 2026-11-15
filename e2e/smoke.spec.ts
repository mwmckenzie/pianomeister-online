import { test, expect } from '@playwright/test'

test('renders the placeholder home page', async ({ page }) => {
  // Relative path so navigation stays under the /pianomeister-online/ base in baseURL.
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PianoMeister Online')
  await expect(
    page.getByRole('list', { name: 'Pitch class colors' }).getByRole('listitem'),
  ).toHaveCount(12)
})
