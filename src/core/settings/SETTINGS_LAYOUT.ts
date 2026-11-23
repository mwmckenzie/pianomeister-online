import type { SettingsTabId, SidebarSectionId, WindowSectionId } from './SettingHome'

/** Order and titles of the settings' homes (brief decision 50). */
export const SETTINGS_LAYOUT = {
  sidebar: [
    { id: 'camera', title: 'Camera' },
    { id: 'keyboard', title: 'Keyboard', resetLabel: 'Reset keyboard to grand piano' },
    { id: 'highway', title: 'Highway' },
    { id: 'loop', title: 'Loop' },
    { id: 'lines', title: 'Lines & glow' },
    { id: 'notes', title: 'Notes' },
    { id: 'noteStyle', title: 'Note style' },
    { id: 'effects', title: 'Effects' },
    { id: 'cages', title: 'Pedal & cages' },
    { id: 'names', title: 'Note names' },
    { id: 'render', title: 'Render quality' },
  ],
  tabs: [
    {
      id: 'practice',
      title: 'Practice',
      sections: [
        { id: 'tempo', title: 'Tempo' },
        { id: 'preRoll', title: 'Pre-roll' },
      ],
    },
    {
      id: 'audio',
      title: 'Audio',
      sections: [
        { id: 'volume', title: 'Volume' },
        { id: 'preRollMetronome', title: 'Pre-roll & metronome' },
        { id: 'soundSource', title: 'Sound source' },
      ],
    },
    {
      id: 'appearance',
      title: 'Appearance',
      sections: [
        { id: 'menuColors', title: 'Menu colors' },
        { id: 'glass', title: 'Glass panels' },
        { id: 'motion', title: 'Motion' },
        { id: 'playerControls', title: 'Player controls' },
        { id: 'start', title: 'Start' },
      ],
    },
  ],
} as const satisfies {
  readonly sidebar: readonly {
    readonly id: SidebarSectionId
    readonly title: string
    readonly resetLabel?: string
  }[]
  readonly tabs: readonly {
    readonly id: SettingsTabId
    readonly title: string
    readonly sections: readonly { readonly id: WindowSectionId; readonly title: string }[]
  }[]
}
