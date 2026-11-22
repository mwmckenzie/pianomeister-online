import type { Texture } from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

const MIX_SHADER = {
  name: 'PianoMeisterMix',
  uniforms: {
    tDiffuse: { value: null as Texture | null },
    tBloom: { value: null as Texture | null },
    uBloom: { value: 0 },
    uVignette: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform float uBloom;
    uniform float uVignette;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color += uBloom * texture2D(tBloom, vUv).rgb;
      // Elliptical falloff towards the corners, over the outer part of the screen only.
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) / max(uAspect, 1.0) * 2.0;
      float v = smoothstep(0.55, 1.45, length(p));
      color *= 1.0 - uVignette * v;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

/**
 * Adds the blurred glow (selective bloom, brief decision 109) and darkens the corners (the
 * vignette); colours stay display-space, as everything the scene draws.
 */
export function createMixPass(): ShaderPass {
  return new ShaderPass(MIX_SHADER)
}
