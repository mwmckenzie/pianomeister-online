import type { ColourSetMerge } from '@/core/color/ColourSetMerge'
import type { BackupMergePlan } from '@/core/library/BackupMergePlan'
import type { ImportPlan } from '@/core/library/ImportPlan'

import type { UploadResult } from './UploadResult'

export interface ImportReport extends Omit<ImportPlan, 'setMeta' | 'setOverrides'> {
  readonly uploads: readonly UploadResult[]
  /** What happened to the backup's profiles (brief decision 75). */
  readonly profiles: BackupMergePlan['summary']
  /** Saved looks the backup added (milestone 9.1). */
  readonly looksAdded: number
  /** Note colour sets the backup adds; the settings store applies them (milestone 10.6). */
  readonly colourSets: ColourSetMerge
}
