import type { LineColor } from '@/core/settings/LineColor'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

const WHITE = '#FFFFFF'

/** A line's colour as hex (brief decision 111): white, a UI colour, or its custom value. */
export function lineColor(
  choice: LineColor,
  custom: string,
  appearance: Pick<PlayerSettings['appearance'], 'primary' | 'secondary'>,
): string {
  switch (choice) {
    case 'white':
      return WHITE
    case 'primary':
      return appearance.primary
    case 'secondary':
      return appearance.secondary
    case 'custom':
      return custom
  }
}
