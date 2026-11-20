import type { Command } from './Command'
import { charKey, codeKey } from './keyBindings'

/**
 * Every keyboard command, declared once (brief decisions 80, 86–89): label, a line for the cheat
 * sheet, default keys and scope. All key handling and every key hint read the effective keys
 * (these defaults plus the user's overrides), so Settings → Shortcuts rebinds them in one place.
 * Keys that belong to a focused control by its ARIA role — sliders and the timeline (arrows,
 * Home/End), text fields (Enter commits), tag and combo boxes — stay with those controls.
 */
export const COMMANDS = [
  // Player (decision 60)
  {
    id: 'playPause',
    label: 'Play / pause',
    description: 'Start or pause playback',
    keys: [codeKey('Space')],
    scope: 'player',
  },
  {
    id: 'previousBar',
    label: 'Previous bar',
    description: 'Jump to the previous bar (early in a bar: the one before)',
    keys: [codeKey('ArrowLeft')],
    scope: 'player',
  },
  {
    id: 'nextBar',
    label: 'Next bar',
    description: 'Jump to the next bar',
    keys: [codeKey('ArrowRight')],
    scope: 'player',
  },
  {
    id: 'stop',
    label: 'Stop',
    description: 'Stop and go back to the loop start, or the song start',
    keys: [codeKey('Home')],
    scope: 'player',
  },
  {
    id: 'tempoDown',
    label: 'Tempo down',
    description: 'Slower by the tempo step',
    keys: [charKey('-')],
    scope: 'player',
  },
  {
    id: 'tempoUp',
    label: 'Tempo up',
    description: 'Faster by the tempo step',
    keys: [charKey('+'), charKey('=')],
    scope: 'player',
  },
  {
    id: 'tempoReset',
    label: 'Tempo to 100%',
    description: 'Back to the song’s own tempo',
    keys: [charKey('0')],
    scope: 'player',
  },
  {
    id: 'toggleLoop',
    label: 'Loop on/off',
    description: 'Turn the loop on (the last range) or off',
    keys: [],
    scope: 'player',
  },
  {
    // The id stays from milestone 7.5, so stored key overrides keep working.
    id: 'revertBookmark',
    label: 'Back to bookmark',
    description: 'Back to the last loaded bookmark (or Full song) as saved',
    keys: [],
    scope: 'player',
  },
  {
    id: 'loopStartEarlier',
    label: 'Loop start −1 bar',
    description: 'Move the loop start a bar earlier (turns the loop on)',
    keys: [],
    scope: 'player',
  },
  {
    id: 'loopStartLater',
    label: 'Loop start +1 bar',
    description: 'Move the loop start a bar later (turns the loop on)',
    keys: [],
    scope: 'player',
  },
  {
    id: 'loopEndEarlier',
    label: 'Loop end −1 bar',
    description: 'Move the loop end a bar earlier (turns the loop on)',
    keys: [],
    scope: 'player',
  },
  {
    id: 'loopEndLater',
    label: 'Loop end +1 bar',
    description: 'Move the loop end a bar later (turns the loop on)',
    keys: [],
    scope: 'player',
  },
  {
    id: 'toggleMetronome',
    label: 'Metronome',
    description: 'Metronome off, or back to its last mode',
    keys: [charKey('m')],
    scope: 'player',
  },
  {
    id: 'saveBookmark',
    label: 'Save as bookmark',
    description: 'Save what’s playing as a bookmark',
    keys: [charKey('b')],
    scope: 'player',
  },
  {
    id: 'openPicker',
    label: 'Change song',
    description: 'Open the song picker',
    keys: [charKey('o')],
    scope: 'player',
  },
  {
    id: 'openLibrary',
    label: 'Library',
    description: 'Open the library',
    keys: [charKey('l')],
    scope: 'player',
  },
  {
    id: 'togglePlayfield',
    label: 'Playfield panel',
    description: 'Show or hide the playfield panel',
    keys: [charKey('p')],
    scope: 'player',
  },
  {
    id: 'openSettings',
    label: 'Settings',
    description: 'Open the settings',
    keys: [charKey(',')],
    scope: 'player',
  },
  // Lists (song picker, library, bookmark manager)
  {
    id: 'listNext',
    label: 'Next in list',
    description: 'Select the next row of the main list',
    keys: [codeKey('ArrowDown')],
    scope: 'lists',
  },
  {
    id: 'listPrevious',
    label: 'Previous in list',
    description: 'Select the previous row of the main list',
    keys: [codeKey('ArrowUp')],
    scope: 'lists',
  },
  {
    id: 'secondaryNext',
    label: 'Next in side list',
    description: 'Select the next row of the side list (Load list, filters)',
    keys: [codeKey('ArrowDown', { shift: true })],
    scope: 'lists',
  },
  {
    id: 'secondaryPrevious',
    label: 'Previous in side list',
    description: 'Select the previous row of the side list (Load list, filters)',
    keys: [codeKey('ArrowUp', { shift: true })],
    scope: 'lists',
  },
  {
    id: 'listFocusNext',
    label: 'Next list',
    description: 'Song picker: move to the Load list',
    keys: [codeKey('ArrowRight')],
    scope: 'lists',
  },
  {
    id: 'listFocusPrevious',
    label: 'Previous list',
    description: 'Song picker: move to the song list',
    keys: [codeKey('ArrowLeft')],
    scope: 'lists',
  },
  {
    id: 'listOpen',
    label: 'Open the selection',
    description: 'Load, play or open the main list’s selection',
    keys: [codeKey('Enter'), codeKey('NumpadEnter')],
    scope: 'lists',
  },
  // Tabs (library and bookmark pages, song picker, settings window)
  {
    id: 'nextTab',
    label: 'Next tab',
    description: 'Library ↔ Bookmarks, the next settings tab; picker: the Load list',
    keys: [charKey(']')],
    scope: 'tabs',
  },
  {
    id: 'previousTab',
    label: 'Previous tab',
    description: 'Library ↔ Bookmarks, the previous settings tab; picker: the song list',
    keys: [charKey('[')],
    scope: 'tabs',
  },
  // Dialogs
  {
    id: 'closeDialog',
    label: 'Close',
    description: 'Close the dialog or popup',
    keys: [codeKey('Escape')],
    scope: 'dialogs',
    fixed: true,
  },
  // Every page
  {
    id: 'goHome',
    label: 'Home',
    description: 'The Welcome screen',
    keys: [charKey('h')],
    scope: 'app',
  },
  {
    id: 'openStats',
    label: 'Stats',
    description: 'The stats page',
    keys: [charKey('s')],
    scope: 'app',
  },
  {
    id: 'showShortcuts',
    label: 'Show shortcuts',
    description: 'This list of keyboard shortcuts',
    keys: [charKey('?')],
    scope: 'app',
  },
] as const satisfies readonly Command[]
