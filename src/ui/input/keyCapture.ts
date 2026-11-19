import { ref } from 'vue'

/**
 * True while Settings → Shortcuts is recording a key (brief decision 84): every command
 * handler, and the dialogs' Esc, stand aside so the key press only becomes the new binding.
 */
export const keyCapture = ref(false)
