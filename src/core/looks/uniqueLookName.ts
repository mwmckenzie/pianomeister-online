/**
 * `name`, or "Name (2)", "Name (3)", … — the first not in `taken` (lower-cased names). Import
 * and backup never overwrite a look because of its name.
 */
export function uniqueLookName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name.toLowerCase())) return name
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}
