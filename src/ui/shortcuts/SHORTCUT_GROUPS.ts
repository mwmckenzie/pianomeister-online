import type { CommandScope } from '@/core/commands/CommandScope'

/** How the Shortcuts tab and the cheat sheet group commands (brief decision 86). */
export const SHORTCUT_GROUPS: readonly {
  readonly scope: CommandScope
  readonly title: string
  readonly where: string
}[] = [
  { scope: 'player', title: 'Player', where: 'While the player has the keyboard' },
  { scope: 'lists', title: 'Lists', where: 'Song picker, library and bookmark manager' },
  {
    scope: 'tabs',
    title: 'Tabs',
    where: 'Library and Bookmarks pages, song picker, settings window',
  },
  {
    scope: 'app',
    title: 'Everywhere',
    where: 'Welcome, player, library, bookmark manager and stats',
  },
  { scope: 'dialogs', title: 'Dialogs', where: 'Any dialog or popup' },
]
