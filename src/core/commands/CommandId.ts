import type { COMMANDS } from './COMMANDS'

export type CommandId = (typeof COMMANDS)[number]['id']
