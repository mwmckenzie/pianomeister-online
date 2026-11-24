import type { PlayerSettings } from '@/core/settings/PlayerSettings'

/** The look's hand colours (the hand cages'), as CSS: notes themselves have none. */
export function handColors(
  cages: Pick<
    PlayerSettings['handCages'],
    'rightColor' | 'rightCustom' | 'leftColor' | 'leftCustom'
  >,
): { readonly right: string; readonly left: string } {
  const css = (color: typeof cages.rightColor, custom: string) =>
    color === 'custom' ? custom : color === 'white' ? '#fff' : `var(--${color})`
  return {
    right: css(cages.rightColor, cages.rightCustom),
    left: css(cages.leftColor, cages.leftCustom),
  }
}
