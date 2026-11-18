import type { BackupMergePlan } from '@/core/library/BackupMergePlan'
import type { ImportPlan } from '@/core/library/ImportPlan'

import type { UploadResult } from './UploadResult'

export interface ImportReport extends Omit<ImportPlan, 'setMeta' | 'setOverrides'> {
  readonly uploads: readonly UploadResult[]
  /** What happened to the backup's profiles (brief decision 75). */
  readonly profiles: BackupMergePlan['summary']
}
