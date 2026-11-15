/**
 * GLSL shared by notes, bar/beat lines, lanes and pedal bands: one tick-to-z mapping and one
 * haze, so everything scrolls and fades together. Visible span: 0 to 1.5 look-aheads ahead of
 * the now line; the haze fades from fully opaque at 1x to fully transparent at 1.5x.
 */
export const TIME_GLSL = /* glsl */ `
uniform float uTick;
uniform float uUnitsPerTick;
uniform float uNowZ;
uniform float uLookAheadTicks;

float tickToZ(float tick) {
  return uNowZ - (tick - uTick) * uUnitsPerTick;
}

float zToTick(float z) {
  return uTick + (uNowZ - z) / uUnitsPerTick;
}

float hazeAlpha(float tick) {
  float ahead = tick - uTick;
  return 1.0 - smoothstep(uLookAheadTicks, 1.5 * uLookAheadTicks, ahead);
}
`
