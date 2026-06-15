import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Bakes a soft, neutral studio environment (via Three's RoomEnvironment) into a
 * PMREM cube map so MeshStandardMaterial/MeshPhysicalMaterial surfaces pick up
 * realistic reflections and ambient highlights without any external HDRI asset.
 */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return {
    texture: envTexture,
    dispose: () => {
      envTexture.dispose();
      pmrem.dispose();
    },
  };
}

/** Vertical "infinite cove" studio backdrop gradient, used as scene.background. */
export function createStudioBackground(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#d9e6f4");
    gradient.addColorStop(0.45, "#eef3f9");
    gradient.addColorStop(1, "#fbfcfe");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Procedural brushed-metal roughness variation, tileable across machined parts. */
export function createBrushedMetalTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2200; i += 1) {
      const y = Math.random() * size;
      const shade = 110 + Math.random() * 120;
      ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.04 + Math.random() * 0.12})`;
      ctx.lineWidth = Math.random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Soft radial AO blob used to ground objects on the floor/table. */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(15, 23, 42, 0.5)");
    gradient.addColorStop(0.6, "rgba(15, 23, 42, 0.18)");
    gradient.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Builds a flat shadow-catcher disc that uses createContactShadowTexture(). */
export function createContactShadow(radius: number, texture: THREE.Texture): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export interface SceneComposer {
  composer: EffectComposer;
  ssao: SSAOPass;
  bloom: UnrealBloomPass;
  setSize: (width: number, height: number) => void;
  render: () => void;
  dispose: () => void;
}

/**
 * Adds an SSAO + bloom + tonemapped-output post-processing chain on top of the
 * renderer's normal output. kernelRadius/min/maxDistance are tuned for a scene
 * scaled in meters (objects ~0.02-1m), which is far smaller than the defaults
 * three's examples assume.
 */
export function createSceneComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): SceneComposer {
  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    samples: 4,
    type: THREE.HalfFloatType,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));

  const ssao = new SSAOPass(scene, camera, width, height);
  ssao.kernelRadius = 0.1;
  ssao.minDistance = 0.0005;
  ssao.maxDistance = 0.06;
  ssao.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssao);

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.08, 0.3, 2.2);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());
  composer.setSize(width, height);

  return {
    composer,
    ssao,
    bloom,
    setSize: (w, h) => composer.setSize(w, h),
    render: () => composer.render(),
    dispose: () => composer.dispose(),
  };
}
