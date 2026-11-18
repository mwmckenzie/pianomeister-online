import type { Command } from './Command'

/**
 * Every keyboard command, declared once (brief decision 80). All key handling looks keys up
 * here, so a later Shortcuts tab (roadmap 7.5) can rebind them in one place. Keys that belong
 * to a focused control by its ARIA role — sliders and the timeline (arrows, Home/End), text
 * fields (Enter commits), tag and combo boxes — stay with those controls and aren't commands.
 */
export const COMMANDS = [
  // Player (decision 60)
  { id: 'playPause', label: 'Play / pause', keys: ['Space'], scope: 'player' },
  { id: 'previousBar', label: 'Previous bar', keys: ['ArrowLeft'], scope: 'player' },
  { id: 'nextBar', label: 'Next bar', keys: ['ArrowRight'], scope: 'player' },
  { id: 'stop', label: 'Stop (back to start)', keys: ['Home'], scope: 'player' },
  { id: 'saveBookmark', label: 'Save as bookmark', keys: ['KeyB'], scope: 'player' },
  { id: 'toggleMetronome', label: 'Metronome', keys: ['KeyM'], scope: 'player' },
  { id: 'openPicker', label: 'Change song', keys: ['KeyO'], scope: 'player' },
  { id: 'openLibrary', label: 'Library', keys: ['KeyL'], scope: 'player' },
  { id: 'togglePlayfield', label: 'Playfield panel', keys: ['KeyP'], scope: 'player' },
  { id: 'openSettings', label: 'Settings', keys: ['Comma'], scope: 'player' },
  // Dialogs
  { id: 'closeDialog', label: 'Close', keys: ['Escape'], scope: 'dialogs' },
  // Lists (song picker, library)
  { id: 'listNext', label: 'Next in list', keys: ['ArrowDown'], scope: 'lists' },
  { id: 'listPrevious', label: 'Previous in list', keys: ['ArrowUp'], scope: 'lists' },
  { id: 'listFocusNext', label: 'Next list', keys: ['ArrowRight'], scope: 'lists' },
  { id: 'listFocusPrevious', label: 'Previous list', keys: ['ArrowLeft'], scope: 'lists' },
  { id: 'listOpen', label: 'Load the selection', keys: ['Enter', 'NumpadEnter'], scope: 'lists' },
] as const satisfies readonly Command[]
