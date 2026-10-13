import { useEffect, useRef } from 'react';
import { introDelay, prefersReducedMotion } from '../lib/motion';
import { buildTerrain, buildTrail, heightAt, lookAt, multiply, perspective, project, RELIEF_HEIGHT } from '../lib/topo';

interface Props {
  /** Élément qui reçoit les variables CSS du défilement et du pointeur. */
  host: React.RefObject<HTMLElement | null>;
}

const VERTEX = `#version 300 es
in vec2 aPos;
in float aH;
in vec3 aN;
uniform mat4 uMVP;
uniform float uRise;
uniform vec2 uShift;
out vec3 vPos;
out vec3 vN;
out float vH;
void main() {
  float h = aH * uRise;
  vPos = vec3(aPos.x, h * ${RELIEF_HEIGHT.toFixed(3)}, aPos.y);
  vN = aN;
  vH = h;
  gl_Position = uMVP * vec4(vPos, 1.0);
  gl_Position.xy += uShift * gl_Position.w;
}`;

// Carte topo : courbes de niveau tous les 1/26 d'altitude, maîtresses toutes les cinq,
// ombrage léger, sentier rose drapé sur le relief (texture), bord fondu dans la nuit.
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vN;
in float vH;
uniform sampler2D uTrail;
uniform float uProgress;
uniform float uRunner;
uniform float uSweep;
uniform float uFade;
uniform vec3 uLight;
out vec4 outColor;

float contour(float v, float width) {
  float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-4);
  return 1.0 - clamp(d - width, 0.0, 1.0);
}

void main() {
  vec3 night = vec3(0.027, 0.11, 0.247);
  vec3 dusk = vec3(0.16, 0.12, 0.33);
  float shade = clamp(dot(normalize(vN), normalize(uLight)), 0.0, 1.0);
  vec3 base = mix(night, dusk, smoothstep(0.0, 1.0, vH)) * (0.55 + 0.7 * shade);

  float lev = vH * 26.0;
  float minor = contour(lev, 0.15);
  float major = contour(lev / 5.0, 0.55);
  // Une vague de lumière parcourt les courbes, du premier plan vers le fond.
  float sweep = exp(-pow((vPos.z - vPos.x * 0.35) - uSweep, 2.0) * 24.0);
  vec3 lineLow = vec3(0.52, 0.25, 0.51);
  vec3 lineHigh = vec3(1.0, 0.86, 0.95);
  vec3 lineColor = mix(lineLow, lineHigh, smoothstep(0.05, 0.9, vH));
  float lines = max(minor * (0.26 + 0.4 * sweep), major * (0.62 + 0.3 * sweep));
  lines *= smoothstep(0.004, 0.05, vH) * (0.55 + 0.45 * smoothstep(0.0, 0.35, vH));
  vec3 color = mix(base, lineColor, lines);

  vec4 trail = texture(uTrail, vPos.xz * 0.5 + 0.5);
  float core = smoothstep(0.3, 0.8, trail.r);
  float drawn = step(trail.g, uProgress) * core;
  float glow = trail.b * smoothstep(0.85, 1.0, uProgress);
  float runner = core * exp(-pow((trail.g - uRunner) * 90.0, 2.0)) * step(0.999, uProgress);
  color = mix(color, vec3(0.996, 0.4, 0.77), clamp(glow * 0.22, 0.0, 1.0));
  color = mix(color, vec3(1.0, 0.55, 0.84), drawn);
  color = mix(color, vec3(1.0), runner);

  float r = length(vPos.xz);
  float alpha = (1.0 - smoothstep(0.62, 0.97, r)) * uFade;
  outColor = vec4(color * alpha, alpha);
}`;

const TRAIL_TEX = 1024;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
}

/** Texture du sentier vu de dessus : R = tracé, G = avancée le long du tracé, B = halo. */
function trailTexture(points: { x: number; z: number }[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TRAIL_TEX;
  const ctx = canvas.getContext('2d')!;
  const px = (p: { x: number; z: number }) => [((p.x + 1) / 2) * TRAIL_TEX, ((p.z + 1) / 2) * TRAIL_TEX] as const;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, TRAIL_TEX, TRAIL_TEX);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Halo flou.
  ctx.filter = 'blur(8px)';
  ctx.strokeStyle = 'rgb(0,0,255)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
  ctx.stroke();
  ctx.filter = 'none';
  // Tracé : chaque segment porte son avancée (0 au départ, 1 au sommet).
  ctx.lineWidth = 3.2;
  for (let i = 1; i < points.length; i++) {
    const g = Math.round(((i - 1) / (points.length - 2)) * 255);
    ctx.strokeStyle = `rgb(255,${g},255)`;
    ctx.beginPath();
    ctx.moveTo(...px(points[i - 1]));
    ctx.lineTo(...px(points[i]));
    ctx.stroke();
  }
  return canvas;
}

/**
 * Décor de l'accueil : un massif en courbes de niveau, en relief, que la caméra
 * contourne lentement. Le sentier se trace du départ au sommet, puis une
 * frontale le parcourt. Sans WebGL 2, le fond dégradé reste seul.
 */
export function TopoScene({ host }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<HTMLSpanElement>(null);
  const summitRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const hostEl = host.current;
    if (!canvas || !hostEl) return;
    const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: true });
    if (!gl) return;
    const reduce = prefersReducedMotion();
    const mobile = () => canvas.clientWidth < 760;

    const terrain = buildTerrain(mobile() ? 130 : 170);
    const trail = buildTrail(terrain);
    const n = terrain.n;

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    } catch (err) {
      console.warn('[accueil] relief indisponible', err);
      return;
    }
    gl.useProgram(program);

    // Grille.
    const pos = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pos.set([(i / (n - 1)) * 2 - 1, (j / (n - 1)) * 2 - 1], (j * n + i) * 2);
    const index = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        index.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], k);
        k += 6;
      }
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attrib = (name: string, data: Float32Array, size: number) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attrib('aPos', pos, 2);
    attrib('aH', terrain.heights, 1);
    attrib('aN', terrain.normals, 3);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trailTexture(trail));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uMVP = u('uMVP');
    const uRise = u('uRise');
    const uShift = u('uShift');
    const uProgress = u('uProgress');
    const uRunner = u('uRunner');
    const uSweep = u('uSweep');
    const uFade = u('uFade');
    gl.uniform3f(u('uLight'), -0.5, 0.9, 0.35);
    gl.uniform1i(u('uTrail'), 0);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    const start = trail[0];
    const summit = terrain.summit;
    const point = (p: { x: number; z: number }, lift = 0): [number, number, number] => [p.x, heightAt(terrain, p.x, p.z) * RELIEF_HEIGHT + lift, p.z];

    let W = 0;
    let H = 0;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile() ? 2 : 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (!running) draw(performance.now());
    };

    // Caméra : tour lent du massif, suit le pointeur, plonge au défilement.
    let clock = 0;
    let pointerX = 0;
    let pointerY = 0;
    let px = 0;
    let py = 0;
    let lift = 0;
    let liftTarget = 0;
    const introStart = performance.now() + introDelay();

    const draw = (now: number) => {
      if (!W || !H) return;
      const t = reduce ? 99 : Math.max(0, (now - introStart) / 1000);
      const ease = (v: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3);
      const rise = ease(t / 1.8);
      const progress = reduce ? 1 : ease((t - 1.2) / 2.6);
      const narrow = mobile();
      const yaw = -0.55 + Math.sin(clock * 0.06) * 0.42 + px * 0.28;
      const pitch = 0.64 + py * 0.08 + lift * 0.3;
      const dist = (narrow ? 4.1 : 1.95) - lift * 0.45;
      const target = [0, 0.12, 0];
      const eye = [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
      const mvp = multiply(perspective(narrow ? 0.62 : 0.56, W / H, 0.1, 20), lookAt(eye, target));
      const shift: [number, number] = narrow ? [0, 0.46] : [0.24, -0.12];

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniform1f(uRise, rise);
      gl.uniform2f(uShift, shift[0], shift[1]);
      gl.uniform1f(uProgress, progress);
      gl.uniform1f(uRunner, (clock * 0.09) % 1.15);
      gl.uniform1f(uSweep, reduce ? 9 : 1.4 - ((clock * 0.18) % 3.2));
      gl.uniform1f(uFade, ease(t / 0.9));
      gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_INT, 0);

      // Repères Départ et Arrivée, posés sur le relief.
      const place = (el: HTMLElement | null, p: { x: number; z: number }, visible: boolean) => {
        if (!el) return;
        const s = project(mvp, point(p, 0.02 * rise), W, H, shift);
        el.style.transform = s ? `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)` : '';
        el.classList.toggle('is-on', !!s && visible);
      };
      place(startRef.current, start, progress > 0.02);
      place(summitRef.current, summit, progress > 0.995);
    };

    let raf = 0;
    let last = 0;
    let running = false;
    let visible = true;
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clock += dt;
      px += (pointerX - px) * (1 - Math.exp(-dt * 3));
      py += (pointerY - py) * (1 - Math.exp(-dt * 3));
      lift += (liftTarget - lift) * (1 - Math.exp(-dt * 6));
      draw(now);
      schedule();
    };
    const schedule = () => {
      if (!raf && running && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const halt = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointerX = e.clientX / window.innerWidth - 0.5;
      pointerY = e.clientY / window.innerHeight - 0.5;
    };
    const onScroll = () => {
      liftTarget = Math.min(1, Math.max(0, window.scrollY / Math.max(1, H)));
      hostEl.style.setProperty('--lift', liftTarget.toFixed(3));
      if (!running) draw(performance.now());
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else halt();
    });
    const onVisibility = () => (document.hidden ? halt() : schedule());
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    if (reduce) {
      draw(performance.now());
    } else {
      running = true;
      observer.observe(canvas);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pointermove', onPointer, { passive: true });
      schedule();
    }
    return () => {
      running = false;
      halt();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [host]);

  return (
    <div className="topo-scene" aria-hidden="true">
      <canvas ref={ref} />
      <span ref={startRef} className="topo-pin topo-pin-start">
        Départ
      </span>
      <span ref={summitRef} className="topo-pin topo-pin-summit">
        Arrivée
      </span>
    </div>
  );
}
