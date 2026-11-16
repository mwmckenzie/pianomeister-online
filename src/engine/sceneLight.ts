/**
 * The scene's one key light plus ambient, shared by the key and note-head shaders (brief
 * decision 43). Colours are display-space values (see RenderPipeline), so this is a simple,
 * hand-tuned shading model rather than physically based lighting:
 * lighter tops, darker fronts and sides, a soft highlight where bevels face the light.
 */
const LIGHT = { x: 0.35, y: 1, z: 0.6 }
const length = Math.hypot(LIGHT.x, LIGHT.y, LIGHT.z)
const dir = [LIGHT.x / length, LIGHT.y / length, LIGHT.z / length].map((v) => v.toFixed(5))

export const LIGHT_GLSL = /* glsl */ `
const vec3 LIGHT_DIR = vec3(${dir.join(', ')});
const float AMBIENT = 0.52;
const float DIFFUSE = 0.55;
const float SPECULAR = 0.35;
const float SHININESS = 48.0;

/** Lit colour of a surface with base colour 'base', unit normal 'n', unit direction to eye 'v'. */
vec3 shade(vec3 base, vec3 n, vec3 v) {
  float diffuse = max(dot(n, LIGHT_DIR), 0.0);
  vec3 h = normalize(LIGHT_DIR + v);
  float specular = pow(max(dot(n, h), 0.0), SHININESS) * step(0.0, dot(n, LIGHT_DIR));
  return base * (AMBIENT + DIFFUSE * diffuse) + vec3(SPECULAR * specular);
}
`
