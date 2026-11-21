/**
 * Note and cage fills, edge rims and note light (brief decisions 112–113), shared by the head,
 * sustain and cage shaders. Needs TIME_GLSL first. Every pattern works in the shape's own
 * coordinates — `u` across (−1..1), `along` in world units from its start, `edge` the world
 * distance in from the nearest outline edge — so it follows the perspective and taper and is
 * never screen-aligned. Solid returns the base unchanged, so the default path is exactly the
 * milestone 8 colour.
 *
 * The fills (brief decision 112, each recognisable at a glance):
 * - Solid: flat note colour. Gradient: bright at the head, fading toward the tail.
 * - Hot core: filled, bright in the middle — a white-hot centre band, a warmer tint, deep
 *   saturated colour at the edges; hottest at the head.
 * - Glass: a tinted block you can see into, a soft wide diagonal sheen, a thin smooth rim.
 * - Outline: dark inside, bright border. Neon: a glowing tube just inside the edge, a dim
 *   coloured haze inside.
 * - Diagonal stripes: two colours per use, box-filtered (no moiré). Smoke: drifting wisps.
 */
export const NOTE_FILL_GLSL = /* glsl */ `
uniform float uHeadFill;
uniform float uSustainFill;
uniform float uGradientEnd;
uniform float uNeonFlicker;
uniform vec4 uHeadStripeA;     // rgb custom, mode (0 note, 1 darker, 2 custom)
uniform vec4 uHeadStripeB;
uniform vec2 uHeadStripeOpacity;
uniform vec4 uHeadStripeShape; // width, balance, angle (rad), drift
uniform vec4 uSustainStripeA;
uniform vec4 uSustainStripeB;
uniform vec2 uSustainStripeOpacity;
uniform vec4 uSustainStripeShape;
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

const float FILL_GRADIENT = 1.0;
const float FILL_HOT_CORE = 2.0;
const float FILL_GLASS = 3.0;
const float FILL_OUTLINE = 4.0;
const float FILL_NEON = 5.0;
const float FILL_STRIPES = 6.0;

/** How far darker "Darker note colour" is. */
const float DARKER = 0.45;

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

bool isFill(float style, float id) {
  return abs(style - id) < 0.5;
}

/** One use's stripes (heads, sustains or a cage). */
struct Stripes {
  vec4 a;
  vec4 b;
  vec2 opacity;
  vec4 shape;
};

struct Fill {
  vec3 color;
  float alpha;    // multiplies the shape's own opacity
  float emission; // extra glow (glow scene)
  float keep;     // share of the alpha kept however see-through the note is set (0..1)
};

vec3 stripeColor(vec4 c, vec3 base) {
  return c.w < 0.5 ? base : c.w < 1.5 ? base * DARKER : c.rgb;
}

/** ∫ of "is stripe A" over [0, x] for stripes of period 1 with share b. */
float stripeIntegral(float x, float b) {
  return floor(x) * b + min(fract(x), b);
}

/**
 * Diagonal stripes, box-filtered over the pixel's footprint (fwidth), so edges stay smooth;
 * as a pair gets narrower than ~4 px on screen the pattern blends into the A/B average, so
 * it never shimmers or forms moiré at a distance.
 */
vec4 stripes(Stripes s, vec3 base, float x, float along) {
  float width = max(s.shape.x, 1e-3);
  float balance = s.shape.y;
  float angle = s.shape.z;
  float drift = s.shape.w * animTime() * 0.6;
  float t = (along * cos(angle) + x * sin(angle) + drift) / (2.0 * width);
  float w = max(fwidth(t), 1e-4);
  float cover = (stripeIntegral(t + 0.5 * w, balance) - stripeIntegral(t - 0.5 * w, balance)) / w;
  cover = mix(cover, balance, smoothstep(0.25, 0.5, w));
  float alphaA = cover * s.opacity.x;
  float alphaB = (1.0 - cover) * s.opacity.y;
  float alpha = alphaA + alphaB;
  vec3 color = (stripeColor(s.a, base) * alphaA + stripeColor(s.b, base) * alphaB) / max(alpha, 1e-4);
  return vec4(color, alpha);
}

/** Coverage of a band [0, width] in from the outline, one pixel soft. */
float band(float edge, float width) {
  float pixel = max(fwidth(edge), 1e-5);
  return 1.0 - smoothstep(width - pixel, width + pixel, edge);
}

Fill noteFill(
  float style, vec3 base, float u, float halfWidth, float along, float len, float seed,
  float edge, Stripes st
) {
  Fill f = Fill(base, 1.0, 0.0, 0.0);
  if (style < 0.5) return f;
  float t = clamp(along / max(len, 1e-3), 0.0, 1.0);
  if (isFill(style, FILL_GRADIENT)) {
    f.color = base * mix(1.0, uGradientEnd, t);
    return f;
  }
  if (isFill(style, FILL_HOT_CORE)) {
    // Filled and bright in the middle: deep saturated edges, a warmer tint, a white-hot band;
    // hottest at the head, cooling a little toward the tail.
    float r = abs(u);
    float heat = mix(1.0, 0.72, t);
    float grey = dot(base, vec3(0.299, 0.587, 0.114));
    vec3 deep = clamp(mix(vec3(grey), base, 1.35), 0.0, 1.0) * 0.8;
    vec3 warm = min(mix(base, vec3(1.0, 0.78, 0.45), 0.35) * 1.2, vec3(1.0));
    float core = exp(-pow(r / 0.3, 2.0)) * heat;
    float flicker = 0.94 + 0.06 * valueNoise(vec2(along * 1.7 + seed * 13.0, animTime() * 6.0));
    vec3 c = mix(deep, warm, 1.0 - smoothstep(0.3, 0.95, r));
    c = mix(c, vec3(1.0, 0.97, 0.9), core);
    f.color = c * mix(0.85, 1.0, heat) * flicker;
    f.emission = 0.9 * core;
    // The white band fades less than the body when the note is see-through.
    f.keep = 0.6 * core;
    return f;
  }
  if (isFill(style, FILL_GLASS)) {
    // A tinted block: you see into it (fairly solid at 0 % transparency), a soft wide sheen
    // running diagonally across it, and a thin smooth rim at the silhouette.
    float x = u * halfWidth;
    float sheen = pow(0.5 + 0.5 * cos(6.2832 * (along + x) / max(halfWidth * 10.0, 1e-3)), 8.0);
    float rim = 1.0 - smoothstep(0.0, max(0.06, halfWidth * 0.22), edge);
    f.color = base * 0.72 + vec3(0.32) * sheen + mix(base, vec3(1.0), 0.5) * rim * 0.4;
    f.alpha = 0.8 + 0.2 * max(rim, sheen);
    return f;
  }
  if (isFill(style, FILL_OUTLINE)) {
    // Dark inside, a bright border.
    float b = band(edge, 0.07);
    f.color = mix(base * 0.22, min(mix(base, vec3(1.0), 0.45) * 1.15, vec3(1.0)), b);
    f.alpha = mix(0.18, 1.0, b);
    f.emission = b;
    f.keep = 0.3 * b;
    return f;
  }
  if (isFill(style, FILL_NEON)) {
    // A neon-sign tube just inside the edge: a near-white core line, the note colour falling
    // off on both sides, a dim coloured haze inside (not dark).
    float inset = min(0.11, halfWidth * 0.3);
    float sigma = max(0.035, fwidth(edge) * 1.2);
    float g = exp(-pow((edge - inset) / sigma, 2.0));
    float lit = 1.0;
    if (uNeonFlicker > 0.5) {
      float n = valueNoise(vec2(seed * 37.0, animTime() * 7.0));
      lit = mix(0.35, 1.0, smoothstep(0.08, 0.2, n));
    }
    vec3 tube = mix(min(base * 1.15, vec3(1.0)), vec3(1.0), pow(g, 6.0) * 0.85);
    f.color = mix(base * 0.42, tube * lit, g);
    f.alpha = mix(0.5, 1.0, g);
    f.emission = 1.3 * g * lit;
    f.keep = 0.3 * g;
    return f;
  }
  if (isFill(style, FILL_STRIPES)) {
    vec4 s = stripes(st, base, u * halfWidth, along);
    f.color = s.rgb;
    f.alpha = s.a;
    return f;
  }
  // Smoke: soft wisps stretched along the note, drifting toward the tail.
  float n = fbm(vec2(u * halfWidth * 1.6, along * 0.35) + vec2(seed * 7.0, -animTime() * 0.35));
  float wisp = smoothstep(0.3, 0.8, n);
  f.color = mix(base * 0.55, mix(base, vec3(1.0), 0.3), wisp);
  f.alpha = 0.45 + 0.55 * wisp;
  return f;
}

/** Outline and Neon draw their own edge: the edge glow doesn't apply to them. */
bool ownEdge(float style) {
  return isFill(style, FILL_OUTLINE) || isFill(style, FILL_NEON);
}

/** Edge rim coverage at world distance d from the nearest edge (constant world width). */
float noteEdge(float d, float style) {
  if (uEdgeOn < 0.5 || ownEdge(style)) return 0.0;
  return band(d, uEdgeWidth);
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
