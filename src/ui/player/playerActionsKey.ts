import type { InjectionKey } from 'vue'

import type { PlayerActions } from './PlayerActions'

/** How Welcome reaches the player it's shown over. */
export const playerActionsKey: InjectionKey<PlayerActions> = Symbol('playerActions')
