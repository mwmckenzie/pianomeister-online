import type { SettingsTabId, SidebarSectionId, WindowSectionId } from './SettingHome'

/** What a reset or a "changed" count covers: one section, one settings tab, or the sidebar. */
export type SettingGroup =
  | { readonly kind: 'section'; readonly id: SidebarSectionId | WindowSectionId }
  | { readonly kind: 'tab'; readonly id: SettingsTabId }
  | { readonly kind: 'sidebar' }
