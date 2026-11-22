import type { InjectionKey } from 'vue'

import type { SectionHints } from './SectionHints'

/** Provided by SettingsSection, injected by its SettingRows. */
export const sectionHintsKey: InjectionKey<SectionHints> = Symbol('sectionHints')
