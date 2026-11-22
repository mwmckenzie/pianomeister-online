import type { DeviceClass } from '@/core/settings/DeviceClass'

/**
 * Tablet = a touch-first pointer and a short screen side of at most 1024 CSS px (brief
 * decision 110). Only used when no device class is stored yet.
 */
export function detectDeviceClass(): DeviceClass {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const shortSide = Math.min(window.screen.width, window.screen.height)
    return coarse && shortSide <= 1024 ? 'tablet' : 'desktop'
  } catch {
    return 'desktop'
  }
}
