import type { KeyBinding } from './KeyBinding'

/**
 * What triggers a command. A tagged union so milestone 11 can add `{ kind: 'midi', … }` for
 * pedals and foot switches without changing how shortcuts are stored (brief decision 88).
 */
export type Binding = KeyBinding
