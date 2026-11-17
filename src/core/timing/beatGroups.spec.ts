// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { beatGroups } from './beatGroups'

describe('beatGroups', () => {
  it('keeps up to five beats in one column', () => {
    expect(beatGroups(2)).toEqual([2])
    expect(beatGroups(3)).toEqual([3])
    expect(beatGroups(4)).toEqual([4])
    expect(beatGroups(5)).toEqual([5])
  })

  it('groups compound meters by their pulse of three', () => {
    expect(beatGroups(6)).toEqual([3, 3])
    expect(beatGroups(9)).toEqual([3, 3, 3])
    expect(beatGroups(12)).toEqual([3, 3, 3, 3])
  })

  it('groups other long bars in fours, remainder last', () => {
    expect(beatGroups(7)).toEqual([4, 3])
    expect(beatGroups(8)).toEqual([4, 4])
    expect(beatGroups(10)).toEqual([4, 4, 2])
  })

  it('shows at least one dot', () => {
    expect(beatGroups(0)).toEqual([1])
  })
})
