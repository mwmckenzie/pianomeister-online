<script setup lang="ts">
import {
  ToastAction,
  ToastClose,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from 'reka-ui'

import { useToastStore } from '../stores/toastStore'
import AppIcon from './AppIcon.vue'

/** Renders the toast queue (Reka Toast): messages, errors, and the single Undo toast. */
const toasts = useToastStore()

function onOpenChange(id: number, open: boolean): void {
  if (!open) toasts.dismiss(id)
}
</script>

<template>
  <ToastProvider swipe-direction="down">
    <ToastRoot
      v-for="toast in toasts.toasts"
      :key="toast.id"
      class="toast glass pm-animated"
      :class="toast.kind"
      :duration="toast.duration"
      :type="toast.kind === 'error' ? 'foreground' : 'background'"
      data-testid="toast"
      :data-kind="toast.kind"
      @update:open="onOpenChange(toast.id, $event)"
    >
      <ToastTitle class="message">{{ toast.message }}</ToastTitle>
      <ToastAction
        v-if="toast.undo"
        class="undo"
        alt-text="Undo the reset"
        data-testid="toast-undo"
        @click="toast.undo()"
      >
        Undo
      </ToastAction>
      <ToastClose class="close" aria-label="Dismiss">
        <AppIcon name="close" :size="16" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport class="toast-viewport" />
  </ToastProvider>
</template>

<style>
.toast-viewport {
  position: fixed;
  z-index: 80;
  bottom: var(--space-6);
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: max-content;
  max-width: calc(100vw - 32px);
  margin: 0;
  padding: 0;
  list-style: none;
  translate: -50% 0;
  outline: none;
  /* A modal dialog turns pointer events off outside itself; Undo must stay clickable while the
     settings window is open (the viewport is a dismissable-layer branch, so it doesn't close it). */
  pointer-events: auto;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 48px;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  --glass-alpha: 0.92;
}

.toast.error {
  border-color: rgb(255 138 138 / 40%);
}

.toast .message {
  font-size: var(--text-sm);
}

.toast .undo {
  min-height: 34px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: 9px;
  background: rgb(var(--primary-rgb) / 18%);
  color: var(--primary);
  font-weight: var(--weight-medium);
  cursor: pointer;
}

.toast .close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}
</style>
