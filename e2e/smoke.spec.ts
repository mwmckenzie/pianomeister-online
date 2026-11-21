import { expect, test } from './fixtures'

test('opens the player as the home page', async ({ page }) => {
  // Relative path so navigation stays under the /pianomeister-online/ base in baseURL.
  await page.goto('./#/')
  await expect(page.getByTestId('stage')).toBeVisible()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(page.getByRole('button', { name: 'Playfield panel (P)' })).toBeVisible()
})

test('serves a web app manifest that Chromium parses without errors', async ({ page }) => {
  await page.goto('./#/')
  const cdp = await page.context().newCDPSession(page)
  const { url, errors } = (await cdp.send('Page.getAppManifest')) as {
    url: string
    errors: { message: string }[]
  }
  expect(url).toMatch(/\/pianomeister-online\/manifest\.webmanifest$/)
  expect(errors).toEqual([])
  const manifest = (await (await page.request.get(url)).json()) as {
    name: string
    start_url: string
    icons: { src: string }[]
  }
  expect(manifest).toMatchObject({
    name: 'PianoMeister Online',
    start_url: '/pianomeister-online/',
  })
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, url).href)
    expect([icon.src, response.status()]).toEqual([icon.src, 200])
    expect(response.headers()['content-type']).toMatch(/^image\//)
  }
})
