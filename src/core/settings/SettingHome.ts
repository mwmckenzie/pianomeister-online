/** Playfield sidebar sections (settings that change what the highway shows). */
export type SidebarSectionId = 'camera' | 'keyboard' | 'highway' | 'notes' | 'effects' | 'render'

/** Settings window tabs that hold settings. */
export type SettingsTabId = 'practice' | 'audio' | 'appearance'

/** Sections inside the settings window tabs. */
export type WindowSectionId =
  | 'preRoll'
  | 'volume'
  | 'preRollMetronome'
  | 'soundSource'
  | 'menuColors'
  | 'glass'
  | 'motion'
  | 'playerControls'

/** Where a setting is shown (brief decision 50); reset groups are derived from it. */
export type SettingHome =
  | { readonly area: 'sidebar'; readonly section: SidebarSectionId }
  | { readonly area: 'window'; readonly tab: SettingsTabId; readonly section: WindowSectionId }
