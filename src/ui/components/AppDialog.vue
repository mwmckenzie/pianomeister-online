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
        <DialogTitle :class="showTitle ? 'dialog-title' : 'visually-hidden'">{{
          title
        }}</DialogTitle>
        <DialogDescription class="visually-hidden">{{ description ?? title }}</DialogDescription>
        <slot />
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

.dialog-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
}
</style>
