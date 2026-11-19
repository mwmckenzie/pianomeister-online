import type { CommandId } from '@/core/commands/CommandId'
import { commandForEvent, type EffectiveBindings } from '@/core/commands/shortcutBindings'

import { isTypingTarget } from './isTypingTarget'
import { keyCapture } from './keyCapture'
import { typesText } from './typesText'

/** Controls that use the arrow keys (and Home/End, Page keys) themselves while focused. */
const OWNS_ARROWS =
  '[role="slider"], input[type="range"], [role="radiogroup"], [role="tablist"], [role="menu"], [role="spinbutton"], [data-owns-arrows]'
const ARROW_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])
/** What a page search field passes on to the lists (decision 91): ↑/↓, Shift+↑/↓ and Enter.
 *  ←/→ stay with the caret, and characters with the text. */
const FROM_SEARCH = new Set<CommandId>([
  'listNext',
  'listPrevious',
  'secondaryNext',
  'secondaryPrevious',
  'listOpen',
])
/** Focused controls that answer Enter themselves; list rows and search fields hand it on. */
const OWNS_ENTER =
  'button, a[href], [role="button"], [role="checkbox"], [role="switch"], [role="tab"], input, select, textarea'

/**
 * The list or tab command a key press runs on a page with lists (brief decisions 90–91): the
 * song picker, the library and the bookmark manager answer wherever focus is, except while a
 * key is being recorded, while typing (a page's own search field, marked `data-list-search`,
 * still passes on keys that type nothing), while a focused control owns the key (sliders, the
 * timeline, segmented controls, tab lists), or while another dialog is open on top. `within`
 * is the dialog the lists live in (the picker); without it, any open dialog blocks them.
 */
export function pageListCommand(
  event: KeyboardEvent,
  bindings: EffectiveBindings,
  within?: HTMLElement | null,
): CommandId | null {
  if (keyCapture.value || event.defaultPrevented) return null
  const target = event.target instanceof HTMLElement ? event.target : null
  const dialogs = [...document.querySelectorAll('[role="dialog"][data-state="open"]')]
  const onTop = dialogs.filter((d) => within == null || !d.contains(within))
  if (onTop.length > 0) return null

  const command =
    commandForEvent(bindings, 'lists', event) ?? commandForEvent(bindings, 'tabs', event)
  if (command === null || target === null) return command

  const inSearch = target.closest('[data-list-search]') !== null
  if (isTypingTarget(target)) {
    if (!inSearch || typesText(event) || !FROM_SEARCH.has(command)) return null
  }
  if (ARROW_KEYS.has(event.code) && target.closest(OWNS_ARROWS) !== null) return null
  if (
    command === 'listOpen' &&
    !inSearch &&
    target.closest('[data-list-row]') === null &&
    target.closest(OWNS_ENTER) !== null
  )
    return null
  return command
}
