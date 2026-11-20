import type { InjectionKey } from 'vue'

import type { OverviewHost } from './OverviewHost'

/** Provided by the player for the loop editor (its child route). */
export const overviewHostKey: InjectionKey<OverviewHost> = Symbol('overviewHost')
