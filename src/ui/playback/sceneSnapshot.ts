import { shallowRef } from 'vue'

/**
 * The last frame of the player's scene (a JPEG data URL), taken when leaving the player, so the
 * library can show it blurred behind its glass. Null until the player has been shown.
 */
export const sceneSnapshot = shallowRef<string | null>(null)
