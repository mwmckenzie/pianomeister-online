// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { makePracticeData } from '../testing/makePracticeData'
import type { PracticeData } from './PracticeData'
import type { ProfileChoice } from './ProfileChoice'
import { formatImportSummary } from './formatImportSummary'
import { planBackupMerge } from './planBackupMerge'
import { profileCollisions } from './profileCollisions'

const MIN = 60_000

function ids() {
  let n = 0
  return () => `new${++n}`
}

function join(...parts: PracticeData[]): PracticeData {
  return {
    profiles: parts.flatMap((p) => p.profiles),
    bookmarks: parts.flatMap((p) => p.bookmarks),
    handAssignments: parts.flatMap((p) => p.handAssignments),
    sessions: parts.flatMap((p) => p.sessions),
    playRecords: parts.flatMap((p) => p.playRecords),
  }
}

/** The local "Me": 12 bookmarks, 260 minutes; the backup's "Me": 8, of which 3 are local too. */
const local = makePracticeData({ bookmarks: 12, minutesEach: 260 / 12, prefix: 'L' })
const backupMe: PracticeData = (() => {
  const own = makePracticeData({ bookmarks: 5, minutesEach: 25, prefix: 'B', startedAt: 100 })
  const shared = makePracticeData({ bookmarks: 3, prefix: 'L' })
  return {
    ...own,
    bookmarks: [...own.bookmarks, ...shared.bookmarks],
    playRecords: [...own.playRecords, ...shared.playRecords],
    handAssignments: [{ profileId: 'default', songId: 'other', hands: { right: [2], left: [3] } }],
  }
})()

const plan = (incoming: PracticeData, choice?: ProfileChoice) =>
  planBackupMerge(
    incoming,
    local,
    new Map(choice === undefined ? [] : [['default', choice]]),
    ids(),
  )

describe('profileCollisions', () => {
  it('describes both sides and the bookmarks after a merge', () => {
    const [collision] = profileCollisions(backupMe, local)
    expect(collision?.local).toMatchObject({ bookmarks: 12, playedMs: 260 * MIN })
    expect(collision?.incoming).toMatchObject({ bookmarks: 8, playedMs: 5 * 25 * MIN + 30 * MIN })
    // 12 local + the 5 the device doesn't have yet.
    expect(collision?.mergedBookmarks).toBe(17)
  })

  it('defaults to Merge when the names match and Add as new when they differ', () => {
    expect(profileCollisions(backupMe, local)[0]?.defaultChoice).toBe('merge')
    const renamed = { ...backupMe, profiles: [{ ...backupMe.profiles[0]!, name: 'Anna' }] }
    expect(profileCollisions(renamed, local)[0]?.defaultChoice).toBe('addNew')
  })

  it('lists only profiles whose id exists here', () => {
    const other = makePracticeData({ profileId: 'p2', name: 'Anna', prefix: 'A' })
    expect(profileCollisions(other, local)).toEqual([])
    expect(profileCollisions(join(backupMe, other), local)).toHaveLength(1)
  })
})

describe('planBackupMerge', () => {
  it('Merge adds only what is missing and changes nothing local', () => {
    const { clearProfileIds, add, summary } = plan(backupMe, 'merge')
    expect(clearProfileIds).toEqual([])
    expect(add.profiles).toEqual([])
    expect(add.bookmarks.map((b) => b.id)).toEqual(['Bb1', 'Bb2', 'Bb3', 'Bb4', 'Bb5'])
    expect(add.playRecords.map((r) => r.id)).toEqual(['Br1', 'Br2', 'Br3', 'Br4', 'Br5'])
    expect(add.sessions.map((s) => s.id)).toEqual(['Bs1'])
    // The local hand assignment for "song" stays; the backup's for "other" is added.
    expect(add.handAssignments.map((h) => h.songId)).toEqual(['other'])
    expect(summary).toEqual({
      merged: [{ name: 'Me', bookmarksAdded: 5 }],
      replaced: [],
      addedProfiles: 0,
    })
  })

  it('a collision without a choice merges', () => {
    expect(plan(backupMe).summary.merged).toEqual([{ name: 'Me', bookmarksAdded: 5 }])
  })

  it('a re-import of the same backup adds nothing', () => {
    expect(planBackupMerge(local, local, new Map(), ids()).add.bookmarks).toEqual([])
  })

  it('Add as new creates a separate "(imported)" profile with fresh ids, references kept', () => {
    const { clearProfileIds, add, summary } = plan(backupMe, 'addNew')
    expect(clearProfileIds).toEqual([])
    expect(add.profiles).toEqual([
      { id: 'new1', name: 'Me (imported)', color: '#8AB4FF', createdAt: 0 },
    ])
    expect(add.bookmarks).toHaveLength(8)
    expect(add.bookmarks.every((b) => b.profileId === 'new1')).toBe(true)
    const bookmarkIds = new Set(add.bookmarks.map((b) => b.id))
    expect([...bookmarkIds].some((id) => id.startsWith('L') || id.startsWith('B'))).toBe(false)
    // Every record points at the new profile, its new session and its new bookmark.
    expect(add.sessions).toHaveLength(1)
    expect(add.playRecords).toHaveLength(8)
    const sessionId = add.sessions[0]?.id
    for (const r of add.playRecords) {
      expect(r.profileId).toBe('new1')
      expect(r.id.startsWith('new')).toBe(true)
      expect(bookmarkIds.has(r.bookmarkId ?? '')).toBe(true)
    }
    // Records of the backup's own session point at its new id; records of a session the backup
    // doesn't contain still get a fresh (consistent) id, never a local one.
    expect(add.playRecords.filter((r) => r.sessionId === sessionId)).toHaveLength(5)
    expect(new Set(add.playRecords.map((r) => r.sessionId)).size).toBe(2)
    expect(add.playRecords.some((r) => r.sessionId === 'Ls1')).toBe(false)
    expect(add.handAssignments).toEqual([
      { profileId: 'new1', songId: 'other', hands: { right: [2], left: [3] } },
    ])
    expect(summary).toEqual({ merged: [], replaced: [], addedProfiles: 1 })
  })

  it('Add as new keeps Full song ids in records', () => {
    const withFull: PracticeData = {
      ...backupMe,
      playRecords: [{ ...backupMe.playRecords[0]!, bookmarkId: 'full:song' }],
    }
    expect(plan(withFull, 'addNew').add.playRecords[0]?.bookmarkId).toBe('full:song')
  })

  it('Replace clears the local profile and writes the backup version', () => {
    const renamed = {
      ...backupMe,
      profiles: [{ ...backupMe.profiles[0]!, name: 'Me', color: '#FFB38A' }],
    }
    const { clearProfileIds, add, summary } = plan(renamed, 'replace')
    expect(clearProfileIds).toEqual(['default'])
    expect(add.profiles).toEqual([renamed.profiles[0]])
    // All 8 backup bookmarks, including the 3 that share ids with the cleared local ones.
    expect(add.bookmarks).toHaveLength(8)
    expect(add.playRecords).toHaveLength(8)
    expect(add.handAssignments).toEqual(backupMe.handAssignments)
    expect(summary).toEqual({ merged: [], replaced: ['Me'], addedProfiles: 0 })
  })

  it('adds a profile without a collision silently, with all its rows', () => {
    const anna = makePracticeData({ profileId: 'p2', name: 'Anna', prefix: 'A', bookmarks: 3 })
    const { add, summary } = plan(join(backupMe, anna), 'merge')
    expect(add.profiles.map((p) => p.name)).toEqual(['Anna'])
    expect(add.bookmarks.filter((b) => b.profileId === 'p2')).toHaveLength(3)
    expect(summary.addedProfiles).toBe(1)
  })

  it('ignores rows of profiles the backup does not list', () => {
    const orphan = { ...makePracticeData({ profileId: 'ghost', prefix: 'G' }), profiles: [] }
    expect(plan(join(backupMe, orphan), 'merge').add.bookmarks.map((b) => b.profileId)).toEqual(
      Array(5).fill('default'),
    )
  })
})

describe('formatImportSummary', () => {
  it('says what happened', () => {
    expect(
      formatImportSummary({
        merged: [{ name: 'Me', bookmarksAdded: 5 }],
        replaced: [],
        addedProfiles: 1,
      }),
    ).toBe('merged into Me (+5 bookmarks), added 1 new profile')
    expect(formatImportSummary({ merged: [], replaced: ['Me'], addedProfiles: 2 })).toBe(
      'replaced Me, added 2 new profiles',
    )
    expect(
      formatImportSummary({
        merged: [{ name: 'Me', bookmarksAdded: 1 }],
        replaced: [],
        addedProfiles: 0,
      }),
    ).toBe('merged into Me (+1 bookmark)')
    expect(formatImportSummary({ merged: [], replaced: [], addedProfiles: 0 })).toBe('')
  })
})
