import type { StorageStatus } from '@/data/StorageStatus'

import { formatBytes } from './formatBytes'

/** "Storage: persistent · 2.1 MB used" (brief decision 33). */
export function formatStorage(status: StorageStatus | null): string {
  if (status === null) return ''
  const persisted =
    status.persisted === null ? 'unknown' : status.persisted ? 'persistent' : 'not persistent'
  const usage = status.usage === null ? '' : ` · ${formatBytes(status.usage)} used`
  return `Storage: ${persisted}${usage}`
}
