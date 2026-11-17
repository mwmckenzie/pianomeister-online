/**
 * True when keyboard shortcuts must stay out of the way: focus is in a text field, text area,
 * select, combo box or editable content (brief decision 60).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    // Buttons, checkboxes, sliders and colour pickers don't take typed text.
    return !['button', 'checkbox', 'radio', 'range', 'color', 'submit', 'reset', 'file'].includes(
      target.type,
    )
  }
  return target.isContentEditable || target.closest('[role="combobox"]') !== null
}
