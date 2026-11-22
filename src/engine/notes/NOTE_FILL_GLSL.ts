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
 * - Hot core: a filled body, bright in the middle — a white-hot centre band, a warmer tint,
 *   deep saturated colour out to the edges; hottest at the head.
 * - Glass: a tinted block you can see into, one continuous soft streak along the note (off
 *   centre), a thin visible rim.
 * - Outline: dark inside, a border at full note brightness. Neon: a glowing tube just inside
 *   the edge with a near-white core line, a coloured haze inside.
 * Each reads at quality Off; bloom only adds the halo.
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
const float FILL_SMOKE = 7.0;
// Round-6 candidates (brief decision 112): the round-1 Smoke for comparison, and three
// replacements for Glass. The ones not picked are removed.
const float FILL_SMOKE_ROUND1 = 8.0;
const float FILL_CRYSTAL = 9.0;
const float FILL_BUBBLES = 10.0;
const float FILL_LIQUID = 11.0;

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

vec2 hash22(vec2 p) {
  return vec2(hash12(p), hash12(p + vec2(19.19, 47.3)));
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
  vec3 glow;      // colour on the glow scene; negative: the fill's own colour
};

/** The colour a fill emits on the glow scene. */
vec3 glowColor(Fill f) {
  return f.glow.r < 0.0 ? f.color : f.glow;
}

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

/** The note colour at full brightness (its largest channel at 1), same hue. */
vec3 fullBright(vec3 c) {
  return c / max(max(c.r, c.g), max(c.b, 1e-3));
}

/** Coverage of a band [0, width] in from the outline, one pixel soft. */
float band(float edge, float width) {
  float pixel = max(fwidth(edge), 1e-5);
  return 1.0 - smoothstep(width - pixel, width + pixel, edge);
}

/**
 * Crystal (candidate): a faceted gem — Voronoi shards in lighter and darker tints of the note
 * colour, each lit from one side as if angled, with bright facet edges. Still.
 */
Fill crystal(Fill f, vec3 base, float u, float halfWidth, float along, float seed) {
  float size = max(halfWidth * 2.2, 1e-3);
  vec2 p = vec2(u * halfWidth, along) / size + vec2(seed * 11.0, 0.0);
  vec2 cell = floor(p);
  float f1 = 8.0;
  float f2 = 8.0;
  vec2 nearest = vec2(0.0);
  vec2 nearestId = cell;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = cell + vec2(float(i), float(j));
      vec2 point = id + 0.15 + 0.7 * hash22(id);
      float d = distance(p, point);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        nearest = point;
        nearestId = id;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  vec3 bright = fullBright(base);
  // Each shard is tilted its own way: lit from the upper left, by its shade and its slope.
  float shade = hash12(nearestId + 7.7);
  float slope = dot(normalize(p - nearest + 1e-4), normalize(vec2(-0.6, 0.8)));
  float lightness = clamp(0.25 + 0.5 * shade + 0.25 * slope * smoothstep(0.0, 0.5, f1), 0.0, 1.0);
  vec3 c = mix(bright * 0.72, mix(bright, vec3(1.0), 0.35), lightness);
  float seam = f2 - f1;
  float edge = 1.0 - smoothstep(0.0, 0.03 + 1.5 * fwidth(seam), seam);
  // Far away the facets blend to their average, never shimmer.
  float far = smoothstep(0.15, 0.4, fwidth(p.y));
  edge *= 1.0 - far;
  c = mix(c, mix(bright, vec3(1.0), 0.35), far * 0.5);
  f.color = mix(c, mix(bright, vec3(1.0), 0.75), edge * 0.85);
  f.alpha = 0.88 + 0.12 * edge;
  f.emission = 0.35 * edge;
  return f;
}

/**
 * Bubbles (candidate): a translucent note-coloured body with small bright bubbles of varied
 * sizes rising toward the tail, each a thin rim with a soft highlight.
 */
Fill bubbles(Fill f, vec3 base, float u, float halfWidth, float along, float seed) {
  float size = max(halfWidth * 2.0, 1e-3);
  vec2 p = vec2(u * halfWidth, along) / size + vec2(seed * 5.0, 0.0);
  p.y -= animTime() * 0.3;
  vec2 cell = floor(p);
  float px = max(fwidth(p.y), 1e-4);
  vec3 bright = fullBright(base);
  float ring = 0.0;
  float glint = 0.0;
  float inside = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = cell + vec2(float(i), float(j));
      vec2 h = hash22(id + 3.3);
      if (h.x > 0.55) continue;
      float r = mix(0.14, 0.36, hash12(id + 9.1));
      // Bubbles sway a little side to side as they rise.
      vec2 c = id + 0.5 + vec2(0.1 * sin(animTime() * 1.3 + h.y * 6.28), 0.0) + 0.2 * (h - 0.5);
      float d = distance(p, c);
      float rim = 1.0 - smoothstep(0.0, 1.5 * px + 0.035, abs(d - r));
      float body = 1.0 - smoothstep(r - px, r + px, d);
      float spot = 1.0 - smoothstep(0.0, r * 0.35 + px, distance(p, c + vec2(-0.35, 0.35) * r));
      ring = max(ring, rim * smoothstep(0.0, 4.0, r / px));
      glint = max(glint, spot * smoothstep(0.0, 4.0, r / px));
      inside = max(inside, body);
    }
  }
  vec3 c = mix(bright * 0.85, mix(bright, vec3(1.0), 0.2), inside * 0.6);
  c = mix(c, mix(bright, vec3(1.0), 0.7), ring * 0.9);
  c = mix(c, vec3(1.0), glint * 0.9);
  f.color = c;
  f.alpha = max(0.5 + 0.2 * inside, max(ring, glint));
  f.emission = 0.4 * max(ring * 0.6, glint);
  f.keep = 0.4 * max(ring, glint);
  return f;
}

/**
 * Liquid (candidate): light through water — a soft network of bright ripples moving slowly
 * inside the note, over the clean note colour.
 */
Fill liquid(Fill f, vec3 base, float u, float halfWidth, float along, float seed) {
  float size = max(halfWidth * 1.3, 1e-3);
  vec2 q = vec2(u * halfWidth, along) / size + vec2(seed * 3.0, 0.0);
  float t = animTime() * 0.6;
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    q += 0.45 * vec2(sin(q.y * 1.7 + t + k * 1.3), cos(q.x * 1.9 - 0.8 * t + k));
  }
  float v = sin(q.x * 2.2) + sin(q.y * 2.2);
  float lines = exp(-abs(v) * 3.5);
  // Ripples narrower than a few pixels settle to an even glow instead of shimmering.
  lines = mix(lines, 0.3, smoothstep(0.4, 1.2, fwidth(v)));
  vec3 bright = fullBright(base);
  f.color = mix(bright * 0.82, mix(bright, vec3(1.0), 0.6), lines * 0.85);
  f.alpha = 0.78 + 0.22 * lines;
  f.emission = 0.3 * lines;
  return f;
}

Fill noteFill(
  float style, vec3 base, float u, float halfWidth, float along, float len, float seed,
  float edge, Stripes st
) {
  Fill f = Fill(base, 1.0, 0.0, 0.0, vec3(-1.0));
  if (style < 0.5) return f;
  float t = clamp(along / max(len, 1e-3), 0.0, 1.0);
  if (isFill(style, FILL_GRADIENT)) {
    f.color = base * mix(1.0, uGradientEnd, t);
    return f;
  }
  if (isFill(style, FILL_HOT_CORE)) {
    // A filled body, bright in the middle: deep saturated colour at full strength out to the
    // edges, a warmer tint inside, a white-hot centre band; hottest at the head. It reads
    // without bloom (bloom only adds the halo).
    float r = abs(u);
    float heat = mix(1.0, 0.75, t);
    float grey = dot(base, vec3(0.299, 0.587, 0.114));
    vec3 deep = clamp(mix(vec3(grey), fullBright(base), 1.3), 0.0, 1.0) * 0.92;
    vec3 warm = min(mix(fullBright(base), vec3(1.0, 0.8, 0.5), 0.4) * 1.1, vec3(1.0));
    float core = exp(-pow(r / 0.22, 2.0)) * heat;
    float flicker = 0.94 + 0.06 * valueNoise(vec2(along * 1.7 + seed * 13.0, animTime() * 6.0));
    vec3 c = mix(deep, warm, 1.0 - smoothstep(0.25, 0.8, r));
    c = mix(c, vec3(1.0, 0.97, 0.9), core);
    f.color = c * mix(0.88, 1.0, heat) * flicker;
    f.emission = 0.9 * core + 0.15;
    // The body stays filled and the white band fades least when the note is see-through.
    f.keep = 0.35 + 0.5 * core;
    return f;
  }
  if (isFill(style, FILL_GLASS)) {
    // A tinted block: you see into it (fairly solid at 0 % transparency), one continuous soft
    // streak along the whole note, off centre (a reflection, never blotches), and a thin rim
    // at least a pixel and a half wide so it shows at any distance.
    float sheen = exp(-pow((u + 0.38) / 0.2, 2.0));
    float rim = band(edge, max(0.035, 1.5 * fwidth(edge)));
    f.color = base * 0.72 + vec3(0.3) * sheen;
    f.color = mix(f.color, mix(fullBright(base), vec3(1.0), 0.55), rim * 0.8);
    f.alpha = 0.8 + 0.2 * max(rim, sheen);
    f.keep = 0.4 * rim;
    return f;
  }
  if (isFill(style, FILL_OUTLINE)) {
    // Dark inside, a border at the note colour's full brightness, never thinner than ~1.5 px,
    // so it holds up far away and without bloom.
    float b = band(edge, max(0.1, 1.5 * fwidth(edge)));
    f.color = mix(base * 0.22, mix(fullBright(base), vec3(1.0), 0.15), b);
    f.alpha = mix(0.18, 1.0, b);
    f.emission = b;
    f.keep = 0.6 * b;
    return f;
  }
  if (isFill(style, FILL_NEON)) {
    // A neon-sign tube just inside the edge, drawn in full without bloom: a near-white core
    // line, the note colour at full brightness falling off on both sides, and a coloured haze
    // filling the inside, brighter toward the tube. Bloom only adds the halo.
    float inset = min(0.11, halfWidth * 0.3);
    float sigma = max(0.04, fwidth(edge) * 2.0);
    float d = edge - inset;
    float core = exp(-pow(d / sigma, 2.0));
    float tube = exp(-abs(d) / (sigma * 4.0));
    float haze = 0.45 + 0.4 * exp(-max(d, 0.0) / max(halfWidth * 0.6, 1e-3));
    float lit = 1.0;
    if (uNeonFlicker > 0.5) {
      float n = valueNoise(vec2(seed * 37.0, animTime() * 7.0));
      lit = mix(0.35, 1.0, smoothstep(0.08, 0.2, n));
    }
    vec3 bright = fullBright(base);
    vec3 c = bright * haze * 0.6;
    c = mix(c, bright * lit, tube);
    c = mix(c, vec3(1.0, 0.98, 0.95) * lit, smoothstep(0.25, 0.85, core));
    f.color = c;
    f.alpha = max(mix(0.55, 0.75, haze), tube);
    // The halo is the tube's saturated colour; near-white stays in the core line only.
    f.emission = 0.9 * tube * lit;
    f.glow = bright;
    f.keep = 0.4 * tube;
    return f;
  }
  if (isFill(style, FILL_STRIPES)) {
    vec4 s = stripes(st, base, u * halfWidth, along);
    f.color = s.rgb;
    f.alpha = s.a;
    return f;
  }
  if (isFill(style, FILL_SMOKE_ROUND1)) {
    // Round 1's Smoke, unchanged, for the side-by-side comparison only.
    float n1 = fbm(vec2(u * halfWidth * 2.0, along * 0.8) + vec2(seed * 7.0, -animTime() * 0.4));
    f.color = base * (0.55 + 0.6 * n1);
    f.alpha = 0.6 + 0.4 * n1;
    return f;
  }
  if (isFill(style, FILL_CRYSTAL)) return crystal(f, base, u, halfWidth, along, seed);
  if (isFill(style, FILL_BUBBLES)) return bubbles(f, base, u, halfWidth, along, seed);
  if (isFill(style, FILL_LIQUID)) return liquid(f, base, u, halfWidth, along, seed);
  // Smoke: soft, billowing, low-contrast clouds of the clean note colour (lighter at their
  // centres, never darker or greyer), with see-through gaps and feathered edges, drifting
  // slowly toward the tail. Noise is sampled the same scale both ways in world space, scaled
  // to the lane, so it reads as puffs rather than streaks.
  float scale = 1.0 / max(halfWidth * 1.4, 1e-3);
  vec2 p = vec2(u * halfWidth, along) * scale + vec2(seed * 7.0, 0.0);
  p.y -= animTime() * 0.25;
  // A gentle domain warp makes the clouds billow instead of tiling.
  p += 0.6 * vec2(fbm(p * 0.6 + vec2(3.1, 1.7)), fbm(p * 0.6 + vec2(8.3, 2.9))) - 0.3;
  float puff = smoothstep(0.3, 0.75, fbm(p));
  f.color = mix(base, vec3(1.0), 0.28 * puff * puff);
  f.alpha = mix(0.18, 0.95, puff);
  f.keep = 0.25 * puff;
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
