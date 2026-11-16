import type { ImportPlan } from '@/core/library/ImportPlan'

import type { UploadResult } from './UploadResult'

export interface ImportReport extends Omit<ImportPlan, 'setMeta' | 'setOverrides'> {
  readonly uploads: readonly UploadResult[]
}
