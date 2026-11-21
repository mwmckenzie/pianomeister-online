import { expect, test } from './fixtures'

test('debug page loads self-hosted samples and plays the Minuet', async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL ?? 'http://localhost').origin
  const consoleErrors: string[] = []
  const externalRequests: string[] = []
  const failedRequests: string[] = []
  page.on('console', (message) => {
    // smplr only warns when a sample fails to load or decode, but a missing sample is a bug.
    const sampleWarning = message.type() === 'warning' && /loading buffer/i.test(message.text())
    if (message.type() === 'error' || sampleWarning) consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith('http') && new URL(url).origin !== appOrigin) externalRequests.push(url)
  })
  page.on('requestfailed', (request) => failedRequests.push(request.url()))
  let sampleResponses = 0
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`)
    if (response.url().includes('/samples/')) {
      sampleResponses++
      // A missing file can come back as the index.html fallback with status 200.
      const type = response.headers()['content-type'] ?? ''
      if (!type.startsWith('audio/')) failedRequests.push(`${type} ${response.url()}`)
    }
  })

  await page.goto('./#/debug')
  await page.getByTestId('fixture-select').selectOption({ label: 'Minuet in G' })
  await expect(page.getByTestId('bar-count')).toHaveText('64')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })

  await page.getByRole('button', { name: 'Play', exact: true }).click()

  // Wait for about a second of playback on the audio clock rather than sleeping.
  await expect
    .poll(async () => Number.parseFloat((await page.getByTestId('song-time').textContent()) ?? ''))
    .toBeGreaterThanOrEqual(1)
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  const barBeat = (await page.getByTestId('bar-beat').textContent()) ?? ''
  expect(Number.parseInt(barBeat.split(':')[0] ?? '', 10)).toBeGreaterThanOrEqual(1)

  // One request per distinct sample: the 12 instruments share one decoded set.
  expect(sampleResponses).toBe(226)
  expect(consoleErrors).toEqual([])
  expect(externalRequests).toEqual([])
  expect(failedRequests).toEqual([])
})
