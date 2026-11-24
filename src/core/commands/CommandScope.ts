/**
 * Where a command's keys apply (brief decision 86): the player screen; lists (song picker,
 * library, bookmark manager); tabs (the library and bookmark pages, the song picker and the
 * settings window); any dialog; or `app`, on every page (player, library, bookmark manager)
 * while no dialog is open. Player never runs together with lists or tabs; dialogs run on top of
 * everything, and app keys work on all pages, so those two conflict with every scope.
 * `listening` (playlist mode, milestone 9.5) replaces the player's keys while listening, so it
 * shares keys with the player; a dialog takes a key before it (Esc closes the dialog first).
 */
export type CommandScope = 'player' | 'listening' | 'lists' | 'tabs' | 'dialogs' | 'app'
