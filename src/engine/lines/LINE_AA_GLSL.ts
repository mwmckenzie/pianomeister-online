/** Coverage of a line of world width `width` at signed world distance `d` from its centre. */
export const LINE_AA_GLSL = /* glsl */ `
// A line's glow is its hue at full brightness: the default line colours are dark greys-blue, and
// glowing in them gave the bloom almost nothing, so the glow slider looked broken.
vec3 glowHue(vec3 c) {
  return c / max(max(c.r, c.g), max(c.b, 0.05));
}
// A soft aura around a line for the bloom to spread: a thin far line alone covers under a pixel.
float glowAura(float d, float width) {
  return 0.35 * exp(-abs(d) / clamp(2.0 * width, 0.04, 0.25));
}
float lineCoverage(float d, float width) {
  float pixel = max(fwidth(d), 1e-5);
  float edge = clamp((0.5 * width - abs(d)) / pixel + 0.5, 0.0, 1.0);
  // A line narrower than a pixel keeps its average brightness by fading, not by aliasing.
  return edge * min(1.0, width / pixel);
}
`
