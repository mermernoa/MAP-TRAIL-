import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { altitudeAt, type ProfilePoint } from '../lib/gpx';
import { fmtKm, fmtM, fmtNum } from './bits';

interface Props {
  points: ProfilePoint[];
  /** Points de passage nommés à marquer sur le profil. */
  markers?: ProfilePoint[];
  height?: number;
  onHoverKm?: (km: number | null) => void;
  /** Position du survol 3D de la carte, en km : curseur et portion déjà parcourue. */
  playKm?: number | null;
  ariaLabel: string;
}

const M = { top: 18, right: 14, bottom: 28, left: 50 };

function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 3.5 ? 2.5 : n < 7 ? 5 : 10;
  return step * pow;
}

/** Profil altimétrique : aire lavée, ligne 2 px, réticule et infobulle au survol. */
export function ElevationProfile({ points, markers = [], height = 220, onHoverKm, playKm = null, ariaLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverKm, setHoverKm] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const maxKm = points[points.length - 1]?.km ?? 1;
    const alts = points.map((p) => p.alt);
    const lo = Math.min(...alts);
    const hi = Math.max(...alts);
    const yStep = niceStep(Math.max(hi - lo, 200), 4);
    const yMin = Math.max(0, Math.floor((lo - yStep * 0.3) / yStep) * yStep);
    const yMax = Math.ceil((hi + yStep * 0.15) / yStep) * yStep;
    const innerW = width - M.left - M.right;
    const innerH = height - M.top - M.bottom;
    const x = (km: number) => M.left + (km / maxKm) * innerW;
    const y = (alt: number) => M.top + innerH - ((alt - yMin) / (yMax - yMin)) * innerH;
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.km).toFixed(1)},${y(p.alt).toFixed(1)}`).join('');
    const area = `${line}L${x(maxKm).toFixed(1)},${y(yMin)}L${x(0).toFixed(1)},${y(yMin)}Z`;
    const xStep = niceStep(maxKm, Math.max(3, Math.floor(innerW / 90)));
    const xTicks: number[] = [];
    for (let k = 0; k <= maxKm + 1e-6; k += xStep) xTicks.push(k);
    const yTicks: number[] = [];
    for (let a = yMin; a <= yMax + 1e-6; a += yStep) yTicks.push(a);
    return { maxKm, x, y, line, area, xTicks, yTicks, yMin, innerW };
  }, [points, width, height]);

  // Seuls le point culminant et le point le plus bas sont étiquetés.
  const labelled = useMemo(() => {
    if (!markers.length) return [];
    const hi = markers.reduce((a, b) => (b.alt > a.alt ? b : a));
    const lo = markers.reduce((a, b) => (b.alt < a.alt ? b : a));
    return hi === lo ? [hi] : [hi, lo];
  }, [markers]);

  const setHover = (km: number | null) => {
    setHoverKm(km);
    onHoverKm?.(km);
  };

  const onMove = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    const km = ((px - M.left) / geo.innerW) * geo.maxKm;
    setHover(Math.min(geo.maxKm, Math.max(0, km)));
  };

  // Le survol de la souris l'emporte sur celui de la carte.
  const cursorKm = hoverKm ?? playKm;
  const hoverAlt = cursorKm != null ? altitudeAt(points, cursorKm) : null;
  const nearest =
    cursorKm != null && markers.length
      ? markers.reduce((a, b) => (Math.abs(b.km - cursorKm) < Math.abs(a.km - cursorKm) ? b : a))
      : null;
  const nearName = nearest && cursorKm != null && Math.abs(nearest.km - cursorKm) <= geo.maxKm * 0.02 ? nearest.label : null;
  const tipLeft = cursorKm != null ? geo.x(cursorKm) : 0;
  const clipId = `profile-done-${useId().replace(/[^\w-]/g, '')}`;

  return (
    <div className="profile" ref={wrapRef}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
        onKeyDown={(e) => {
          const step = geo.maxKm / 100;
          if (e.key === 'ArrowRight') setHover(Math.min(geo.maxKm, (hoverKm ?? -step) + step));
          else if (e.key === 'ArrowLeft') setHover(Math.max(0, (hoverKm ?? step) - step));
          else if (e.key === 'Escape') setHover(null);
          else return;
          e.preventDefault();
        }}
        onBlur={() => setHover(null)}
      >
        <g className="profile-grid">
          {geo.yTicks.map((a) => (
            <g key={a}>
              <line x1={M.left} x2={width - M.right} y1={geo.y(a)} y2={geo.y(a)} />
              <text x={M.left - 8} y={geo.y(a)} dy="0.32em" textAnchor="end">
                {fmtNum(a)}
              </text>
            </g>
          ))}
          {geo.xTicks.map((k) => (
            <text key={k} x={geo.x(k)} y={height - 8} textAnchor="middle">
              {k === 0 ? '0 km' : Math.round(k)}
            </text>
          ))}
        </g>
        <path d={geo.area} className="profile-area" />
        <path d={geo.line} className="profile-line" />
        {playKm != null && playKm > 0 && (
          <g className="profile-done" clipPath={`url(#${clipId})`}>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={geo.x(Math.min(playKm, geo.maxKm))} height={height} />
            </clipPath>
            <path d={geo.area} className="profile-done-area" />
            <path d={geo.line} className="profile-done-line" />
          </g>
        )}
        {markers.map((mk, i) => (
          <circle key={i} cx={geo.x(mk.km)} cy={geo.y(mk.alt)} r={3.5} className="profile-marker" />
        ))}
        {labelled.map((mk, i) => {
          const px = geo.x(mk.km);
          const anchor = px < M.left + 60 ? 'start' : px > width - M.right - 60 ? 'end' : 'middle';
          const isHigh = i === 0;
          return (
            <text
              key={mk.label ?? i}
              x={px}
              y={isHigh || geo.y(mk.alt) + 16 > height - M.bottom - 4 ? geo.y(mk.alt) - 9 : geo.y(mk.alt) + 16}
              textAnchor={anchor}
              className="profile-label"
            >
              {mk.label} {fmtM(mk.alt)}
            </text>
          );
        })}
        {cursorKm != null && hoverAlt != null && (
          <g className={`profile-cursor ${hoverKm == null ? 'is-flying' : ''}`}>
            <line x1={geo.x(cursorKm)} x2={geo.x(cursorKm)} y1={M.top} y2={height - M.bottom} />
            <circle cx={geo.x(cursorKm)} cy={geo.y(hoverAlt)} r={5} />
          </g>
        )}
      </svg>
      {cursorKm != null && hoverAlt != null && (
        <div
          className="profile-tip"
          style={{ left: Math.min(Math.max(tipLeft, 70), width - 70) }}
          role="status"
        >
          <strong>{fmtKm(cursorKm)}</strong>
          <span>{fmtM(hoverAlt)}</span>
          {nearName && <span className="muted">{nearName}</span>}
        </div>
      )}
    </div>
  );
}

/** Silhouette du profil pour le bas de l'en-tête (décor, masqué aux lecteurs d'écran). */
export function ProfileHorizon({ points }: { points: ProfilePoint[] }) {
  if (points.length < 2) return null;
  const maxKm = points[points.length - 1].km;
  const alts = points.map((p) => p.alt);
  const lo = Math.min(...alts);
  const hi = Math.max(...alts);
  const W = 1000;
  const H = 120;
  const y = (a: number) => H - 8 - ((a - lo) / Math.max(1, hi - lo)) * (H - 24);
  const d =
    points.map((p, i) => `${i ? 'L' : 'M'}${((p.km / maxKm) * W).toFixed(1)},${y(p.alt).toFixed(1)}`).join('') +
    `L${W},${H}L0,${H}Z`;
  return (
    <svg className="race-hero-horizon" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
