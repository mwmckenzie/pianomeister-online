import { readFileSync } from 'node:fs'

import { test, expect, type Page } from '@playwright/test'

import { choose, seedBookmark, seedPractice, SONG_IDS, watchErrors } from './support'

/** Milestone 7.7: the stats page (m7-7 decisions 14–23). */

const MIN = 60_000
const DAY = 86_400_000

const headline = (page: Page, label: string) =>
  page.locator(`[data-testid="headline"][data-label="${label}"]`)

/** Minuet today (20 min) and 100 days ago (40 min), Canon 10 days ago (30 min). */
async function seedHistory(page: Page): Promise<void> {
  const now = Date.now()
  const record = (id: string, songId: string, daysAgo: number, minutes: number, plays: number) => ({
    id,
    profileId: 'default',
    sessionId: id,
    songId,
    bookmarkId: id === 'today' ? 'b' : `full:${songId}`,
    startedAt: now - daysAgo * DAY - minutes * MIN - 60_000,
    playedMs: minutes * MIN,
    plays,
    tempoPercent: 85,
    loop: id === 'today' ? { startBar: 17, endBar: 32 } : null,
  })
  await seedPractice(page, {
    bookmarks: [seedBookmark('b', 'B section', { startBar: 17, endBar: 32 })],
    playRecords: [
      record('today', SONG_IDS.minuet, 0, 20, 4),
      record('canon', SONG_IDS.canon, 10, 30, 3),
      record('old', SONG_IDS.minuet, 100, 40, 2),
    ],
  })
}

async function openStats(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await seedHistory(page)
  await page.goto('./#/stats')
  await expect(page.getByTestId('stats-title')).toHaveText('Stats · Me')
}

test('the range and the song filter change the numbers', async ({ page }) => {
  const errors = watchErrors(page)
  await openStats(page)
  const time = headline(page, 'Practice time').getByTestId('headline-value')
  // 30 days (the default): today and 10 days ago.
  await expect(time).toHaveText('50')
  await expect(headline(page, 'Days practised')).toContainText('2of 30')
  await expect(headline(page, 'Plays').getByTestId('headline-value')).toHaveText('7')

  await page.getByTestId('stats-range').getByText('7 days', { exact: true }).click()
  await expect(time).toHaveText('20')
  await expect(headline(page, 'Days practised')).toContainText('1of 7')
  // The previous 7 days had Canon's 30 minutes: a third less this week.
  await expect(headline(page, 'Practice time').getByTestId('headline-note')).toHaveText(
    '-33% vs previous 7 days',
  )

  await page.getByTestId('stats-range').getByText('12 months', { exact: true }).click()
  await expect(time).toHaveText('1 h 30')
  await expect(page.getByTestId('minutes-card')).toContainText('Minutes per week')

  // One song: Canon only.
  await choose(page, page.getByTestId('stats-song'), 'Canon in D')
  await expect(time).toHaveText('30')
  await expect(page.getByTestId('top-card')).toContainText('Top bookmarks')
  await expect(page.getByTestId('top-card').getByTestId('top-row')).toHaveText([/Full song/])
  expect(errors).toEqual([])
})

test('a change against the previous window, top songs and the minutes table', async ({ page }) => {
  const errors = watchErrors(page)
  await openStats(page)
  await page.getByTestId('stats-range').getByText('12 months', { exact: true }).click()
  await expect(page.getByTestId('top-card').getByTestId('top-row')).toHaveText([
    /Minuet in G.*1 h/,
    /Canon in D.*30 min/,
  ])
  // Show as table: the chart becomes a table with the same values.
  const card = page.getByTestId('minutes-card')
  await card.getByTestId('show-table').click()
  await expect(card.getByTestId('chart-table')).toBeVisible()
  await expect(card.getByTestId('chart-table').locator('tbody tr')).not.toHaveCount(0)
  await card.getByTestId('show-table').click()
  await expect(card.getByTestId('chart-bar').first()).toBeVisible()
  // Hovering a bar shows its tooltip.
  await card.getByTestId('chart-bar').last().hover()
  await expect(card.getByTestId('chart-tooltip')).toContainText('20 min')
  // Tempo progress needs two weeks: one week shows the empty state.
  await expect(page.getByTestId('tempo-empty')).toBeVisible()
  expect(errors).toEqual([])
})

test('Export CSV downloads the records of the range and filter', async ({ page }) => {
  const errors = watchErrors(page)
  await openStats(page)
  await page.getByTestId('stats-range').getByText('All', { exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-csv').click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('pianomeister-me-all.csv')
  const csv = readFileSync(await download.path(), 'utf8').replace(/^﻿/, '')
  const lines = csv.trimEnd().split('\r\n')
  expect(lines[0]).toBe(
    'Date,Time,Song,Bookmark,Minutes,Plays,Tempo %,Loop,Hands,Pre-roll,Metronome',
  )
  expect(lines).toHaveLength(4)
  expect(lines[3]).toContain(',Minuet in G,B section,20.0,4,85,17–32,')
  expect(lines[2]).toContain(',Canon in D,Full song,30.0,3,85,,')
  expect(errors).toEqual([])
})

test('with no history the page says so and nothing can be exported', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/stats')
  await expect(page.getByTestId('stats-empty')).toBeVisible()
  await expect(page.getByTestId('export-csv')).toBeDisabled()
  await expect(headline(page, 'Practice time').getByTestId('headline-value')).toHaveText('0')
  expect(errors).toEqual([])
})
