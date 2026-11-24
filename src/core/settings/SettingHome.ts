/** Playfield sidebar sections (settings that change what the highway shows). */
export type SidebarSectionId =
  | 'camera'
  | 'keyboard'
  | 'highway'
  | 'loop'
  | 'lines'
  | 'notes'
  | 'noteStyle'
  | 'effects'
  | 'cages'
  | 'names'
  | 'render'

/** Settings window tabs that hold settings. */
export type SettingsTabId = 'practice' | 'audio' | 'appearance' | 'library'

/** Sections inside the settings window tabs. */
export type WindowSectionId =
  | 'tempo'
  | 'preRoll'
  | 'volume'
  | 'preRollMetronome'
  | 'soundSource'
  | 'playback'
  | 'listening'
  | 'menuColors'
  | 'noteColours'
  | 'glass'
  | 'motion'
  | 'playerControls'
  | 'start'
  | 'handDetection'

/** Where a setting is shown (brief decision 50); reset groups are derived from it. */
export type SettingHome =
  | { readonly area: 'sidebar'; readonly section: SidebarSectionId }
  | { readonly area: 'window'; readonly tab: SettingsTabId; readonly section: WindowSectionId }
