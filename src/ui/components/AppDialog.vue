<script setup lang="ts">
import { commandForKey } from '@/core/commands/commandKeys'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

/**
 * A centred glass dialog (Reka Dialog): focus is trapped while open, Esc and the backdrop close
 * it, and focus returns to what opened it.
 *
 * With `showTitle` it lays itself out like the picker and settings window: a padded title, the
 * default slot as the body, and the `footer` slot as a right-aligned button row (`.dialog-text`
 * styles a plain paragraph). Without it, the content brings its own layout (picker, settings).
 */
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    readonly title: string
    readonly description?: string
    /** Shows the title as a heading; otherwise it's for screen readers only. */
    readonly showTitle?: boolean
    readonly width?: string
    readonly height?: string
  }>(),
  { description: undefined, showTitle: false, width: '1200px', height: 'auto' },
)
const open = defineModel<boolean>('open', { required: true })

/**
 * Esc from anywhere inside closes the dialog. Reka's own Esc handling only acts when the dialog
 * is the top layer, and tooltips opened by keyboard focus inside it can leave it thinking it
 * isn't. While a popup is open above it (popover, select list, combo box; tooltips excluded),
 * Esc belongs to that popup: Reka closes it at the document, after this handler has run.
 */
function onKeyDown(event: KeyboardEvent): void {
  if (commandForKey('dialogs', event.code) !== 'closeDialog' || event.defaultPrevented) return
  const popupOpen = document.querySelector(
    '[data-reka-popper-content-wrapper] > [data-state="open"]',
  )
  if (popupOpen === null) open.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay pm-fade" />
      <DialogContent
        class="dialog-content glass pm-animated"
        :style="{ '--dialog-width': width, '--dialog-height': height }"
        v-bind="$attrs"
        @keydown="onKeyDown"
      >
        <template v-if="showTitle">
          <header class="dialog-header">
            <DialogTitle class="dialog-title">{{ title }}</DialogTitle>
          </header>
          <DialogDescription class="visually-hidden">{{ description ?? title }}</DialogDescription>
          <div class="dialog-body"><slot /></div>
          <footer v-if="$slots.footer" class="dialog-footer"><slot name="footer" /></footer>
        </template>
        <template v-else>
          <DialogTitle class="visually-hidden">{{ title }}</DialogTitle>
          <DialogDescription class="visually-hidden">{{ description ?? title }}</DialogDescription>
          <slot />
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.dialog-overlay {
  position: fixed;
  z-index: 40;
  inset: 0;
  background: var(--scrim);
}

.dialog-content {
  position: fixed;
  z-index: 41;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  width: min(var(--dialog-width), calc(100vw - 32px));
  height: min(var(--dialog-height), calc(100dvh - 32px));
  max-height: calc(100dvh - 32px);
  overflow: hidden;
  border-radius: var(--radius-lg);
  translate: -50% -50%;
}

.dialog-content:focus {
  outline: none;
}

/* The standard layout (showTitle): the picker's spacing — 22 px sides, 10 px between buttons. */
.dialog-header {
  flex-shrink: 0;
  padding: 20px 22px 0;
}

.dialog-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
  line-height: 1.3;
}

.dialog-body {
  flex: 1;
  min-height: 0;
  padding: 12px 22px 0;
  overflow-y: auto;
}

.dialog-footer {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px 22px 22px;
}

.dialog-text {
  margin: 0;
  color: var(--text-2);
  line-height: 1.5;
}
</style>
