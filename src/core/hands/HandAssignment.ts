export interface HandAssignment {
  readonly right: readonly number[]
  readonly left: readonly number[]
}

export const DEFAULT_HAND_ASSIGNMENT: HandAssignment = { right: [0], left: [1] }
