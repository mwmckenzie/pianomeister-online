/**
 * GLSL shared by notes, bar/beat lines, lanes, cages and effects: one tick-to-z mapping and one
 * haze, so everything scrolls and fades together. Visible span: 0 to 1.5 look-aheads ahead of
 * the now line; the haze fades from fully opaque at 1x to fully transparent at 1.5x.
 */
export const TIME_GLSL = /* glsl */ `
uniform float uTick;
uniform float uUnitsPerTick;
uniform float uNowZ;
uniform float uLookAheadTicks;
uniform float uTime;
uniform float uLoopTime;
uniform float uPausedFor;
uniform float uTicksPerSecond;
uniform float uJumpTick;
uniform float uReducedMotion;
uniform float uClipLo;
uniform float uClipHi;
uniform float uLoopStart;
uniform float uLoopEnd;
uniform float uLoopPeriod;
uniform float uLoopRepeat;
uniform float uLoopDim;
uniform float uBandStart;
uniform float uBandEnd;
uniform float uBandDeck;
uniform float uBandCurve;

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

/**
 * The song tick shown at a highway tick: beyond the loop end, while the repeat shows, each period
 * shows the iteration again (core loopSongTick). Layers drawn per repeat already pass song ticks.
 */
float loopSongTick(float tick) {
  if (uLoopRepeat < 0.5 || tick < uLoopEnd || uLoopPeriod <= 0.0) return tick;
  return tick - (floor((tick - uLoopEnd) / uLoopPeriod) + 1.0) * uLoopPeriod;
}

/** How much to dim at a highway tick: outside [loop start, loop end), by the dim strength. */
float loopDim(float tick) {
  if (uLoopDim <= 0.0) return 0.0;
  float t = loopSongTick(tick);
  return (t >= uLoopStart && t < uLoopEnd) ? 0.0 : uLoopDim;
}

/** The ending song's gain at a tick of the crossfade band: core crossfadeGains, out. */
float bandGain(float tick) {
  float t = clamp((tick - uBandStart) / max(uBandEnd - uBandStart, 1.0), 0.0, 1.0);
  if (uBandCurve < 0.5) t = min(1.0, t / 0.6);
  float c = cos(t * 1.5707963);
  return uBandCurve > 1.5 ? c : c * c;
}

/**
 * The ending song's strength in the playlist crossfade band (milestone 9.5): its notes follow
 * its gain where they start, and, once they sound, its gain now; never quite gone. Everything
 * else keeps full strength.
 */
float bandStrength(float deck, float startTick) {
  if (uBandDeck < 0.0 || abs(deck - uBandDeck) > 0.5) return 1.0;
  float tick = max(startTick, uTick);
  return tick < uBandStart ? 1.0 : mix(0.1, 1.0, bandGain(tick));
}

/** The looping animation clock: still while paused and under reduced motion. */
float animTime() {
  return uLoopTime * (1.0 - uReducedMotion);
}
`
