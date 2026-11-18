/**
 * Where a command's keys apply: the player screen (window-wide while no dialog has the
 * keyboard), any dialog, or a focused list (song picker, library).
 */
export type CommandScope = 'player' | 'dialogs' | 'lists'
