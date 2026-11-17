/**
 * How the HUD's beat dots are grouped into columns so the stack stays about as tall as the bar
 * counter: up to 5 beats in one column; 6 or more in groups of 3 when that divides evenly
 * (6/8 → 3+3, 9/8 → 3+3+3, 12/8 → 3+3+3+3), otherwise in 4s with the remainder last
 * (7 → 4+3, 8 → 4+4, 10 → 4+4+2). Returns the size of each group, in beat order.
 */
export function beatGroups(beats: number): number[] {
  const count = Math.max(1, Math.floor(beats))
  if (count <= 5) return [count]
  const size = count % 3 === 0 ? 3 : 4
  const groups: number[] = []
  for (let left = count; left > 0; left -= size) groups.push(Math.min(size, left))
  return groups
}
