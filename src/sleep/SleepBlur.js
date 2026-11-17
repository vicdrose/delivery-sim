import * as THREE from 'three';
import { CONFIG } from '../config.js';

const SLEEP = CONFIG.sleep;
const MAX_STEP = 2.1;

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BLUR_SHADER = `
uniform sampler2D tInput;
uniform vec2 step;
varying vec2 vUv;

void main() {
  vec4 sum = texture2D(tInput, vUv) * 0.227027;
  sum += texture2D(tInput, vUv + step) * 0.1945946;
  sum += texture2D(tInput, vUv - step) * 0.1945946;
  sum += texture2D(tInput, vUv + step * 2.0) * 0.1216216;
  sum += texture2D(tInput, vUv - step * 2.0) * 0.1216216;
  sum += texture2D(tInput, vUv + step * 3.0) * 0.054054;
  sum += texture2D(tInput, vUv - step * 3.0) * 0.054054;
  sum += texture2D(tInput, vUv + step * 4.0) * 0.016216;
  sum += texture2D(tInput, vUv - step * 4.0) * 0.016216;
  gl_FragColor = sum;
}
`;

const COMPOSITE_SHADER = `
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform float intensity;
varying vec2 vUv;

void main() {
  vec3 sharp = texture2D(tSharp, vUv).rgb;
  vec2 toEdge = vUv - 0.5;
  float dist = length(toEdge);
  vec2 dir = toEdge / max(dist, 0.0001);
  float smear = 0.016 * intensity;
  vec3 soft = mix(
    texture2D(tBlur, vUv).rgb,
    texture2D(tBlur, vUv + dir * smear).rgb,
    0.5
  );
  vec3 color = mix(sharp, soft, clamp(intensity * 1.15, 0.0, 1.0));
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(color, vec3(luma), 0.2 * intensity);
  float vig = smoothstep(0.35, 0.92, dist);
  color *= 1.0 - vig * 0.3 * intensity;
  gl_FragColor = vec4(color, 1.0);
}
`;

export function blurIntensityFor(value) {
  const span = Math.max(1, SLEEP.blurFull - SLEEP.blurOnset);
  const t = (value - SLEEP.blurOnset) / span;
  if (t <= 0) return 0;
  return Math.min(1, Math.pow(t, 1.15));
}

export class SleepBlur {
  constructor(renderer) {
    this.renderer = renderer;
    this.intensity = 0;
    this.target = 0;
    this.width = 0;
    this.height = 0;
    this.halfWidth = 0;
    this.halfHeight = 0;
    this._size = new THREE.Vector2();

    this.sharpTexture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    this.sharpTexture.minFilter = THREE.LinearFilter;
    this.sharpTexture.magFilter = THREE.LinearFilter;
    this.sharpTexture.generateMipmaps = false;

    const targetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false
    };

    this.blurA = new THREE.WebGLRenderTarget(1, 1, {
      ...targetOptions,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false
    });

    this.blurB = new THREE.WebGLRenderTarget(1, 1, {
      ...targetOptions,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: null },
        step: { value: new THREE.Vector2() }
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: BLUR_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tSharp: { value: null },
        tBlur: { value: null },
        intensity: { value: 0 }
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: COMPOSITE_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMaterial);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.resize();
  }

  resize() {
    this.renderer.getDrawingBufferSize(this._size);
    const width = Math.max(1, Math.floor(this._size.x));
    const height = Math.max(1, Math.floor(this._size.y));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.halfWidth = Math.max(1, Math.floor(width / 2));
    this.halfHeight = Math.max(1, Math.floor(height / 2));

    this.sharpTexture.image = {
      data: new Uint8Array(width * height * 4),
      width,
      height
    };
    this.sharpTexture.needsUpdate = true;

    this.blurA.setSize(this.halfWidth, this.halfHeight);
    this.blurB.setSize(this.halfWidth, this.halfHeight);
  }

  update(dt, target) {
    const value = Math.min(1, Math.max(0, Number.isFinite(target) ? target : 0));
    this.target = value;
    const rate = Math.max(0, Number.isFinite(dt) ? dt : 0) * SLEEP.blurFadeRate;
    const k = 1 - Math.exp(-rate);
    this.intensity += (this.target - this.intensity) * k;
    if (this.intensity < 0.002) this.intensity = 0;
  }

  render(scene, camera) {
    this.resize();

    this.renderer.setRenderTarget(null);
    this.renderer.render(scene, camera);

    if (this.intensity <= 0.001) return;

    this.renderer.copyFramebufferToTexture(this.sharpTexture);

    const scale = this.height / 1080;
    const step = MAX_STEP * scale * this.intensity;
    const iterations = this.intensity > 0.32 ? 2 : 1;
    let source = this.sharpTexture;

    for (let i = 0; i < iterations; i += 1) {
      const pass = i === 0 ? step : step * 0.6;
      this._pass(source, this.blurA, pass, 0);
      this._pass(this.blurA.texture, this.blurB, 0, pass);
      source = this.blurB.texture;
    }

    this.compositeMaterial.uniforms.tSharp.value = this.sharpTexture;
    this.compositeMaterial.uniforms.tBlur.value = source;
    this.compositeMaterial.uniforms.intensity.value = this.intensity;
    this.quad.material = this.compositeMaterial;

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  _pass(source, target, spreadX, spreadY) {
    this.blurMaterial.uniforms.tInput.value = source;
    this.blurMaterial.uniforms.step.value.set(
      spreadX / this.halfWidth,
      spreadY / this.halfHeight
    );
    this.quad.material = this.blurMaterial;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose() {
    this.sharpTexture.dispose();
    this.blurA.dispose();
    this.blurB.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
