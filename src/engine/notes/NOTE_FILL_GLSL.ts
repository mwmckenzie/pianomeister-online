/**
 * Note and cage fills, edge rims and note light (brief decisions 112–113), shared by the head,
 * sustain and cage shaders. Needs TIME_GLSL first. Every pattern works in the shape's own
 * coordinates — `u` across (−1..1), `along` in world units from its start — so it follows the
 * perspective and taper and is never screen-aligned. Solid returns the base unchanged, so the
 * default path is exactly the milestone 8 colour.
 */
export const NOTE_FILL_GLSL = /* glsl */ `
uniform float uHeadFill;
uniform float uSustainFill;
uniform float uGradientEnd;
uniform float uStripeWidth;
uniform float uStripeDrift;
uniform float uEdgeOn;
uniform float uEdgeWidth;
uniform float uEdgeIntensity;
uniform float uPulseOn;
uniform float uPulseAmount;
uniform float uPulseDecay;
uniform float uSoundingOn;
uniform float uSoundingAmount;
uniform float uBreathing;
uniform float uVelScaling;
uniform float uVelMin;
uniform float uVelMax;
uniform float uOctaves;

const float FILL_NEON = 4.0;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

/** Fractal noise, 1–3 octaves (shader detail), normalised to 0..1. */
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 3; i++) {
    if (float(i) >= uOctaves) break;
    sum += amp * valueNoise(p);
    norm += amp;
    p = p * 2.03 + vec2(17.1, 9.2);
    amp *= 0.5;
  }
  return sum / max(norm, 1e-4);
}

struct Fill {
  vec3 color;
  float alpha;    // multiplies the shape's own opacity
  float emission; // extra glow (glow layer)
};

Fill noteFill(float style, vec3 base, float u, float halfWidth, float along, float len, float seed) {
  Fill f = Fill(base, 1.0, 0.0);
  if (style < 0.5) return f;
  if (style < 1.5) {
    // Gradient along the note, head to tail.
    float t = clamp(along / max(len, 1e-3), 0.0, 1.0);
    f.color = base * mix(1.0, uGradientEnd, t);
    return f;
  }
  if (style < 2.5) {
    // Hot core: a bright centre, darker edges, a gentle flicker.
    float core = 1.0 - u * u;
    core *= core;
    float flicker = 0.88 + 0.12 * valueNoise(vec2(along * 1.7 + seed * 13.0, animTime() * 6.0));
    f.color = mix(base * 0.3, mix(base, vec3(1.0), 0.5), core) * flicker;
    f.emission = 0.8 * core;
    return f;
  }
  if (style < 3.5) {
    // Glass: see-through, brighter at the edges, a highlight streak.
    float rim = smoothstep(0.55, 1.0, abs(u));
    float streak = exp(-pow((u + 0.45) * 6.0, 2.0));
    f.color = base * 0.55 + base * rim * 0.4 + vec3(0.9) * streak * 0.5;
    f.alpha = 0.35 + 0.35 * rim + 0.3 * streak;
    return f;
  }
  if (style < 4.5) {
    // Neon: hollow; the edge (forced on, see noteEdge) carries the colour.
    f.color = base * 0.5;
    f.alpha = 0.12;
    return f;
  }
  if (style < 5.5) {
    // Fat diagonal stripes fixed to the note; optional slow drift along it.
    float drift = uStripeDrift * animTime() * 0.6;
    float s = (along + u * halfWidth + drift) / (2.0 * uStripeWidth);
    float tri = abs(fract(s) - 0.5) * 2.0;
    float edge = fwidth(s) * 2.0 + 1e-4;
    float stripe = smoothstep(0.5 - edge, 0.5 + edge, tri);
    f.color = base * mix(1.0, 0.45, stripe);
    return f;
  }
  // Smoke: soft animated noise.
  float n = fbm(vec2(u * halfWidth * 2.0, along * 0.8) + vec2(seed * 7.0, -animTime() * 0.4));
  f.color = base * (0.55 + 0.6 * n);
  f.alpha = 0.6 + 0.4 * n;
  return f;
}

/**
 * Edge rim coverage at world distance d from the nearest edge (constant world width, one pixel
 * soft). Neon fills force a wider rim on.
 */
float noteEdge(float d, float style) {
  float neon = step(FILL_NEON - 0.5, style) * step(style, FILL_NEON + 0.5);
  float on = max(uEdgeOn, neon);
  if (on < 0.5) return 0.0;
  float w = uEdgeWidth * mix(1.0, 1.5, neon);
  float pixel = max(fwidth(d), 1e-5);
  return 1.0 - smoothstep(w - pixel, w + pixel, d);
}

float edgeIntensity(float style) {
  float neon = step(FILL_NEON - 0.5, style) * step(style, FILL_NEON + 0.5);
  return mix(uEdgeIntensity, max(uEdgeIntensity, 1.0), neon);
}

float velocityFactor(float velocity) {
  return uVelScaling > 0.5 ? mix(uVelMin, uVelMax, velocity / 127.0) : 1.0;
}

/**
 * Note-on flash: 1 at the onset, fading over the decay; none for notes before the last jump.
 * Paused, the fade carries on in wall-clock time (uPausedFor), so the frame settles.
 */
float notePulse(float startTick, float velocity) {
  if (uPulseOn < 0.5 || startTick <= uJumpTick || uTick < startTick) return 0.0;
  float age = (uTick - startTick) / max(uTicksPerSecond, 1.0) + uPausedFor;
  float p = max(0.0, 1.0 - age / max(uPulseDecay, 1e-3));
  return p * p * uPulseAmount * velocityFactor(velocity);
}

/** Extra brightness while the note sounds, with optional breathing. */
float noteSounding(float startTick, float endTick) {
  if (uSoundingOn < 0.5 || uTick < startTick || uTick >= endTick) return 0.0;
  float breathe = 1.0 + uBreathing * 0.35 * sin(animTime() * 4.0);
  return uSoundingAmount * breathe;
}
`
