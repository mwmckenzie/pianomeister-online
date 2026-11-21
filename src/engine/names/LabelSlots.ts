/**
 * A layer's label stack slots, per "Label repeated notes" choice: with only the first of each
 * run labelled, the unlabelled repeats don't take slots.
 */
export interface LabelSlots {
  readonly first: Uint8Array
  readonly all: Uint8Array
}
