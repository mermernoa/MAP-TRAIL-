import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Médaille de finisher en verre optique, rendue en temps réel : disque de verre
 * épais (réfraction, dispersion, irisation) cerclé de prune, montagne rose et
 * soleil encre pris dans la masse, ruban aux couleurs de la marque.
 * Chargée à la demande : three.js n'alourdit pas le reste du site.
 */

const PINK = '#fe66c4';
const INK = '#071c3f';
const PLUM = '#854183';

interface Options {
  /** Avec le ruban (illustration) ou seule (pastille). */
  ribbon: boolean;
  /** Première image dessinée : on peut masquer l'image de repli. */
  onReady?: () => void;
}

function ribbonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PINK;
  ctx.fillRect(0, 0, 64, 4);
  ctx.fillStyle = INK;
  ctx.fillRect(26, 0, 12, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(22, 0, 3, 4);
  ctx.fillRect(39, 0, 3, 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function mountainShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.62, -0.36);
  s.lineTo(-0.17, 0.34);
  s.lineTo(0.03, 0.04);
  s.lineTo(0.24, 0.4);
  s.lineTo(0.64, -0.36);
  s.closePath();
  return s;
}

export function mountGlassMedal(host: HTMLElement, { ribbon, onReady }: Options): () => void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'glass-medal-canvas';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;

  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(PINK, 0.8);
  rim.position.set(-4, -1, -3);
  scene.add(rim);

  const medal = new THREE.Group();
  scene.add(medal);
  const disposables: { dispose(): void }[] = [pmrem, envMap];
  const keep = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  // Disque de verre épais aux bords arrondis.
  const disc = new THREE.Shape();
  disc.absarc(0, 0, 0.9, 0, Math.PI * 2, false);
  const glassGeo = keep(
    new THREE.ExtrudeGeometry(disc, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.11, bevelSize: 0.09, bevelSegments: 10, curveSegments: 128 }),
  );
  glassGeo.center();
  const glass = keep(
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.04,
      metalness: 0,
      transmission: 1,
      thickness: 0.9,
      ior: 1.52,
      dispersion: 4,
      iridescence: 0.55,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [180, 520],
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      attenuationColor: new THREE.Color(PINK),
      attenuationDistance: 3.4,
      envMapIntensity: 1.3,
    }),
  );
  medal.add(new THREE.Mesh(glassGeo, glass));

  // Montagne et soleil pris dans le verre.
  const mountainGeo = keep(
    new THREE.ExtrudeGeometry(mountainShape(), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }),
  );
  mountainGeo.translate(0, -0.06, -0.03);
  const pinkMat = keep(new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.35, metalness: 0.05, emissive: PINK, emissiveIntensity: 0.12 }));
  medal.add(new THREE.Mesh(mountainGeo, pinkMat));
  const sunGeo = keep(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 48));
  sunGeo.rotateX(Math.PI / 2);
  const inkMat = keep(new THREE.MeshStandardMaterial({ color: INK, roughness: 0.4, metalness: 0.1 }));
  const sun = new THREE.Mesh(sunGeo, inkMat);
  sun.position.set(0.4, 0.5, 0);
  medal.add(sun);

  // Cerclage et bélière en prune métallisé.
  const plumMat = keep(new THREE.MeshPhysicalMaterial({ color: PLUM, metalness: 0.75, roughness: 0.22, clearcoat: 0.6, envMapIntensity: 1.2 }));
  const rimGeo = keep(new THREE.TorusGeometry(0.995, 0.07, 32, 160));
  medal.add(new THREE.Mesh(rimGeo, plumMat));
  const loopGeo = keep(new THREE.TorusGeometry(0.13, 0.036, 24, 64));
  const loop = new THREE.Mesh(loopGeo, plumMat);
  loop.position.set(0, 1.17, 0);
  medal.add(loop);

  let ribbonTex: THREE.CanvasTexture | null = null;
  if (ribbon) {
    ribbonTex = keep(ribbonTexture());
    const bandGeo = keep(new THREE.BoxGeometry(0.5, 1.75, 0.025));
    const bandMat = keep(new THREE.MeshStandardMaterial({ map: ribbonTex, roughness: 0.55, metalness: 0.05 }));
    for (const side of [-1, 1]) {
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(side * 0.3, 2.02, -0.14 - (side > 0 ? 0.03 : 0));
      band.rotation.z = -side * 0.3;
      medal.add(band);
    }
  }

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const target = ribbon ? new THREE.Vector3(0, 0.88, 0) : new THREE.Vector3(0, 0.08, 0);
  const frameHeight = ribbon ? 4.15 : 2.6;
  const frameWidth = ribbon ? 2.5 : 2.5;
  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Recul suffisant pour cadrer la médaille en hauteur comme en largeur.
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = frameHeight / 2 / Math.tan(vFov / 2);
    const distW = frameWidth / 2 / (Math.tan(vFov / 2) * camera.aspect);
    camera.position.set(0, target.y, Math.max(distH, distW) + 0.6);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  resize();

  // Inclinaison vers le pointeur et balancement lent.
  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    pointer.x = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1);
    pointer.y = THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1);
    schedule();
  };

  let raf = 0;
  let visible = true;
  let first = true;
  const clock = new THREE.Clock();
  const draw = () => {
    raf = 0;
    const t = clock.getElapsedTime();
    if (reduce) {
      medal.rotation.set(0.06, -0.38, 0);
    } else {
      tilt.x += (pointer.x - tilt.x) * 0.06;
      tilt.y += (pointer.y - tilt.y) * 0.06;
      medal.rotation.y = Math.sin(t * 0.45) * 0.55 + tilt.x * 0.45;
      medal.rotation.x = tilt.y * 0.22 + Math.sin(t * 0.7) * 0.03;
      medal.position.y = Math.sin(t * 0.9) * 0.04;
    }
    renderer.render(scene, camera);
    if (first) {
      first = false;
      onReady?.();
    }
    if (!reduce) schedule();
  };
  const schedule = () => {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
  });
  observer.observe(host);
  const ro = new ResizeObserver(() => {
    resize();
    schedule();
  });
  ro.observe(host);
  const onVisibility = () => schedule();
  document.addEventListener('visibilitychange', onVisibility);
  if (!reduce) window.addEventListener('pointermove', onPointer, { passive: true });
  schedule();

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    for (const d of disposables) d.dispose();
    room.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    renderer.dispose();
    canvas.remove();
  };
}
