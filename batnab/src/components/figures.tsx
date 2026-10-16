// Small SVG drawing kit for test figures: coordinate plots (lines, curves, shaded systems of
// inequalities) and geometry sketches (points, segments, angle and length marks, ellipses).
// Everything is drawn in currentColor so it follows the page's text colour.
import {useId, type ReactNode} from 'react';

type P = [number, number];
/** a·x + b·y = c (a line), or a·x + b·y ≤ c (a half-plane) */
export type Linear = [number, number, number];

const FONT = 13;

// ---------------------------------------------------------------- coordinate plots

interface PlotProps {
  x: [number, number];
  y: [number, number];
  /** Pixels per unit. */
  scale?: number;
  lines?: Linear[];
  curve?: (x: number) => number;
  /** Hatched intersection of half-planes. */
  region?: Linear[];
  dashed?: [P, P][];
  xLabels?: [number, string][];
  yLabels?: [number, string][];
}

/** Clip the line a·x + b·y = c to the box; null if it misses. */
function clipLine([a, b, c]: Linear, [x0, x1]: [number, number], [y0, y1]: [number, number]): [P, P] | null {
  const pts: P[] = [];
  if (b !== 0) {
    for (const x of [x0, x1]) {
      const y = (c - a * x) / b;
      if (y >= y0 - 1e-9 && y <= y1 + 1e-9) pts.push([x, y]);
    }
  }
  if (a !== 0) {
    for (const y of [y0, y1]) {
      const x = (c - b * y) / a;
      if (x >= x0 - 1e-9 && x <= x1 + 1e-9) pts.push([x, y]);
    }
  }
  if (pts.length < 2) return null;
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return [pts[0], pts[pts.length - 1]];
}

/** Sutherland–Hodgman: clip a convex polygon by a·x + b·y ≤ c. */
function clipPolygon(poly: P[], [a, b, c]: Linear): P[] {
  const inside = (p: P) => a * p[0] + b * p[1] <= c + 1e-9;
  const out: P[] = [];
  poly.forEach((cur, i) => {
    const prev = poly[(i + poly.length - 1) % poly.length];
    const cross = (): P => {
      const t = (c - a * prev[0] - b * prev[1]) / (a * (cur[0] - prev[0]) + b * (cur[1] - prev[1]));
      return [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])];
    };
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross());
      out.push(cur);
    } else if (inside(prev)) out.push(cross());
  });
  return out;
}

export function Plot({x, y, scale = 18, lines = [], curve, region, dashed = [], xLabels = [], yLabels = []}: PlotProps) {
  const id = useId().replace(/:/g, '');
  const pad = 14;
  const w = (x[1] - x[0]) * scale + pad * 2;
  const h = (y[1] - y[0]) * scale + pad * 2;
  const sx = (v: number) => pad + (v - x[0]) * scale;
  const sy = (v: number) => pad + (y[1] - v) * scale;
  const pt = ([a, b]: P) => `${sx(a).toFixed(1)},${sy(b).toFixed(1)}`;

  let shaded: P[] | null = null;
  if (region) {
    shaded = [[x[0], y[0]], [x[1], y[0]], [x[1], y[1]], [x[0], y[1]]];
    for (const half of region) shaded = clipPolygon(shaded, half);
  }

  let curvePath = '';
  if (curve) {
    let pen = false;
    for (let i = 0; i <= 240; i++) {
      const vx = x[0] + ((x[1] - x[0]) * i) / 240;
      const vy = curve(vx);
      if (vy < y[0] || vy > y[1]) {
        pen = false;
        continue;
      }
      curvePath += `${pen ? 'L' : 'M'}${pt([vx, vy])}`;
      pen = true;
    }
  }

  const arrow = `arrow-${id}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="max-w-full" fill="none" stroke="currentColor" strokeWidth={1.3}>
      <defs>
        <marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="currentColor" stroke="none" />
        </marker>
        <pattern id={`hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0,3 H6" stroke="currentColor" strokeWidth={0.9} />
        </pattern>
      </defs>
      {shaded && shaded.length > 2 && <polygon points={shaded.map(pt).join(' ')} fill={`url(#hatch-${id})`} stroke="none" opacity={0.75} />}
      <line x1={sx(x[0])} y1={sy(0)} x2={sx(x[1]) + 8} y2={sy(0)} markerEnd={`url(#${arrow})`} strokeWidth={1} />
      <line x1={sx(0)} y1={sy(y[0])} x2={sx(0)} y2={sy(y[1]) - 8} markerEnd={`url(#${arrow})`} strokeWidth={1} />
      <g fill="currentColor" stroke="none" fontSize={FONT} fontStyle="italic">
        <text x={sx(x[1]) - 2} y={sy(0) + 15}>x</text>
        <text x={sx(0) - 13} y={sy(y[1]) + 2}>y</text>
        <text x={sx(0) - 11} y={sy(0) - 4} fontStyle="normal">
          O
        </text>
      </g>
      {xLabels.map(([v, t]) => (
        <g key={`x${v}`}>
          <line x1={sx(v)} y1={sy(0) - 3} x2={sx(v)} y2={sy(0) + 3} strokeWidth={1} />
          <text x={sx(v)} y={sy(0) + 15} textAnchor="middle" fontSize={FONT - 1} fill="currentColor" stroke="none">
            {t}
          </text>
        </g>
      ))}
      {yLabels.map(([v, t]) => (
        <g key={`y${v}`}>
          <line x1={sx(0) - 3} y1={sy(v)} x2={sx(0) + 3} y2={sy(v)} strokeWidth={1} />
          <text x={sx(0) - 5} y={sy(v) + 4} textAnchor="end" fontSize={FONT - 1} fill="currentColor" stroke="none">
            {t}
          </text>
        </g>
      ))}
      {lines.map((l, i) => {
        const seg = clipLine(l, x, y);
        return seg && <line key={i} x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} strokeWidth={1.6} />;
      })}
      {curvePath && <path d={curvePath} strokeWidth={1.6} />}
      {dashed.map(([p, q], i) => (
        <line key={`d${i}`} x1={sx(p[0])} y1={sy(p[1])} x2={sx(q[0])} y2={sy(q[1])} strokeDasharray="4 3" strokeWidth={1} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- geometry sketches

type Mark =
  | ['right', string, string, string] // right-angle square at vertex between two rays
  | ['angle', string, string, string, string?, number?] // arc at vertex (+ text), number of arcs
  | ['ticks', string, string, number] // equal-length ticks on a segment
  | ['len', string, string, string, number?]; // length text beside a segment (side ±1)

interface GeoProps {
  /** Points in math coordinates (y up). */
  pts: Record<string, P>;
  /** 'AB' joins single-letter points; [from, to] or [from, to, 'dash'] for any names. */
  segs?: (string | [string, string] | [string, string, 'dash'])[];
  /** Point names to print; [name, dx, dy] to place by hand (pixels, y down). */
  labels?: (string | [string, number, number])[];
  marks?: Mark[];
  /** Ellipse around a point (radii in units); dashBack draws the far (upper) half dashed. */
  ellipses?: {c: string; rx: number; ry: number; dashBack?: boolean}[];
  texts?: [P, string][];
  width?: number;
}

const unit = ([x, y]: P): P => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

export function Geo({pts, segs = [], labels = [], marks = [], ellipses = [], texts = [], width = 220}: GeoProps) {
  const all = Object.values(pts);
  const extra: P[] = ellipses.flatMap((e) => [
    [pts[e.c][0] - e.rx, pts[e.c][1] - e.ry],
    [pts[e.c][0] + e.rx, pts[e.c][1] + e.ry],
  ]);
  const xs = [...all, ...extra].map((p) => p[0]);
  const ys = [...all, ...extra].map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 20;
  const k = (width - pad * 2) / Math.max(maxX - minX, 1e-6);
  const height = (maxY - minY) * k + pad * 2;
  const S = ([x, y]: P): P => [pad + (x - minX) * k, pad + (maxY - y) * k];
  const p = (n: string) => S(pts[n]);
  const centre = S([all.reduce((s, q) => s + q[0], 0) / all.length, all.reduce((s, q) => s + q[1], 0) / all.length]);

  const items: ReactNode[] = [];
  segs.forEach((s, i) => {
    const [a, b, dash] = typeof s === 'string' ? [s[0], s[1], undefined] : [s[0], s[1], s[2]];
    const [P1, P2] = [p(a), p(b)];
    items.push(<line key={`s${i}`} x1={P1[0]} y1={P1[1]} x2={P2[0]} y2={P2[1]} strokeDasharray={dash ? '4 3' : undefined} />);
  });

  ellipses.forEach((e, i) => {
    const [cx, cy] = p(e.c);
    const [rx, ry] = [e.rx * k, e.ry * k];
    if (!e.dashBack) items.push(<ellipse key={`e${i}`} cx={cx} cy={cy} rx={rx} ry={ry} />);
    else {
      items.push(<path key={`e${i}f`} d={`M${cx - rx},${cy} A${rx},${ry} 0 0 0 ${cx + rx},${cy}`} />);
      items.push(<path key={`e${i}b`} d={`M${cx - rx},${cy} A${rx},${ry} 0 0 1 ${cx + rx},${cy}`} strokeDasharray="4 3" />);
    }
  });

  marks.forEach((m, i) => {
    if (m[0] === 'right') {
      const [V, A, B] = [p(m[1]), p(m[2]), p(m[3])];
      const u = unit([A[0] - V[0], A[1] - V[1]]);
      const v = unit([B[0] - V[0], B[1] - V[1]]);
      const s = 9;
      items.push(
        <path
          key={`m${i}`}
          d={`M${V[0] + u[0] * s},${V[1] + u[1] * s} L${V[0] + (u[0] + v[0]) * s},${V[1] + (u[1] + v[1]) * s} L${V[0] + v[0] * s},${V[1] + v[1] * s}`}
          strokeWidth={1}
        />,
      );
    } else if (m[0] === 'angle') {
      const [V, A, B] = [p(m[1]), p(m[2]), p(m[3])];
      const a1 = Math.atan2(A[1] - V[1], A[0] - V[0]);
      let a2 = Math.atan2(B[1] - V[1], B[0] - V[0]);
      let d = a2 - a1;
      while (d <= -Math.PI) d += 2 * Math.PI;
      while (d > Math.PI) d -= 2 * Math.PI;
      a2 = a1 + d;
      const arcs = m[5] ?? 1;
      for (let j = 0; j < arcs; j++) {
        const r = 16 + j * 4;
        const [x1, y1] = [V[0] + r * Math.cos(a1), V[1] + r * Math.sin(a1)];
        const [x2, y2] = [V[0] + r * Math.cos(a2), V[1] + r * Math.sin(a2)];
        items.push(<path key={`m${i}-${j}`} d={`M${x1},${y1} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${x2},${y2}`} strokeWidth={1} />);
      }
      if (m[4]) {
        const mid = a1 + d / 2;
        const r = 30;
        items.push(
          <text key={`m${i}t`} x={V[0] + r * Math.cos(mid)} y={V[1] + r * Math.sin(mid) + 4} textAnchor="middle" fontSize={FONT - 2} fill="currentColor" stroke="none">
            {m[4]}
          </text>,
        );
      }
    } else if (m[0] === 'ticks') {
      const [A, B] = [p(m[1]), p(m[2])];
      const u = unit([B[0] - A[0], B[1] - A[1]]);
      const n: P = [-u[1], u[0]];
      const mid: P = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      for (let j = 0; j < m[3]; j++) {
        const off = (j - (m[3] - 1) / 2) * 3.5;
        const c: P = [mid[0] + u[0] * off, mid[1] + u[1] * off];
        items.push(<line key={`m${i}-${j}`} x1={c[0] - n[0] * 5} y1={c[1] - n[1] * 5} x2={c[0] + n[0] * 5} y2={c[1] + n[1] * 5} strokeWidth={1.2} />);
      }
    } else {
      const [A, B] = [p(m[1]), p(m[2])];
      const u = unit([B[0] - A[0], B[1] - A[1]]);
      const side = m[4] ?? 1;
      const n: P = [-u[1] * side, u[0] * side];
      items.push(
        <text key={`m${i}`} x={(A[0] + B[0]) / 2 + n[0] * 11} y={(A[1] + B[1]) / 2 + n[1] * 11 + 4} textAnchor="middle" fontSize={FONT - 1} fill="currentColor" stroke="none">
          {m[3]}
        </text>,
      );
    }
  });

  labels.forEach((l, i) => {
    const [name, dx, dy] = typeof l === 'string' ? [l, undefined, undefined] : l;
    const P0 = p(name);
    let off: P;
    if (dx !== undefined && dy !== undefined) off = [dx, dy];
    else {
      const d = unit([P0[0] - centre[0], P0[1] - centre[1]]);
      off = [d[0] * 12, d[1] * 12];
    }
    items.push(
      <text key={`l${i}`} x={P0[0] + off[0]} y={P0[1] + off[1] + 4} textAnchor="middle" fontSize={FONT} fill="currentColor" stroke="none">
        {name}
      </text>,
    );
  });

  texts.forEach(([at, t], i) => {
    const [x, y] = S(at);
    items.push(
      <text key={`t${i}`} x={x} y={y + 4} textAnchor="middle" fontSize={FONT - 1} fill="currentColor" stroke="none">
        {t}
      </text>,
    );
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="max-w-full" fill="none" stroke="currentColor" strokeWidth={1.4}>
      {items}
    </svg>
  );
}
