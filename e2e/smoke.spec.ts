import { test, expect } from '@playwright/test'

test('opens the player as the home page', async ({ page }) => {
  // Relative path so navigation stays under the /pianomeister-online/ base in baseURL.
  await page.goto('./')
  await expect(page.getByTestId('stage')).toBeVisible()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()
})
