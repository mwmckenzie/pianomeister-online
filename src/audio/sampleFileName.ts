/**
 * File name (without extension) for a smplr sample name. Upstream names contain spaces and '#'
 * ("Mf C#5"), which static servers decode inconsistently ('%23' stays encoded under Vite's
 * decodeURI, so the request falls through to index.html). Keep the same rule in
 * scripts/fetch-piano-samples.mjs.
 */
export function sampleFileName(sampleName: string): string {
  return sampleName.replace(/#/g, 's').replace(/ /g, '_')
}
