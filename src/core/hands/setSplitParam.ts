import type { SplitAlgorithm } from './SplitAlgorithm'

/** Sets a method's parameter, keeping only values that differ from its defaults. */
export function setSplitParam(
  algorithm: SplitAlgorithm,
  params: Readonly<Record<string, number>>,
  key: string,
  value: number,
): Record<string, number> {
  const { [key]: _old, ...rest } = params
  const isDefault = algorithm.params.find((p) => p.key === key)?.default === value
  return isDefault ? rest : { ...rest, [key]: value }
}
