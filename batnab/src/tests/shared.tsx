// Figures that appear (with small changes) in both variants of a test.
import {Geo, Plot, type Linear} from '../components/figures';

const n = (v: number) => (v < 0 ? `−${-v}` : `${v}`);

/** The five line graphs offered for "x + y = ±2". */
export const lineChoices = () => [
  <Plot x={[-3, 3]} y={[-3, 3]} scale={13} lines={[[1, -1, 2]]} xLabels={[[2, '2']]} yLabels={[[-2, n(-2)]]} />,
  <Plot x={[-3, 3]} y={[-3, 3]} scale={13} lines={[[1, -1, 0]]} />,
  <Plot x={[-3, 3]} y={[-3, 3]} scale={13} lines={[[1, 1, -2]]} xLabels={[[-2, n(-2)]]} yLabels={[[-2, n(-2)]]} />,
  <Plot x={[-3, 3]} y={[-3, 3]} scale={13} lines={[[-1, 1, 2]]} xLabels={[[-2, n(-2)]]} yLabels={[[2, '2']]} />,
  <Plot x={[-3, 3]} y={[-3, 3]} scale={13} lines={[[1, 1, 2]]} xLabels={[[2, '2']]} yLabels={[[2, '2']]} />,
];

/** Graphs for "the line x = k" / "the line y = k" (2.А: k = 3, x; 2.Б: k = 2, y). */
export const axisLineChoices = (k: number, axis: 'x' | 'y') => {
  const p = {x: [-4, 4] as [number, number], y: [-4, 4] as [number, number], scale: 11};
  const horizontal = (v: number) => <Plot {...p} lines={[[0, 1, v]]} yLabels={[[v, n(v)]]} />;
  const vertical = (v: number) => <Plot {...p} lines={[[1, 0, v]]} xLabels={[[v, n(v)]]} />;
  return axis === 'x'
    ? [horizontal(k), <Plot {...p} lines={[[1, -1, 0]]} />, vertical(k), <Plot {...p} lines={[[1, 1, 0]]} />, vertical(-k)]
    : [horizontal(k), <Plot {...p} lines={[[1, -1, 0]]} />, vertical(k), <Plot {...p} lines={[[1, 1, 0]]} />, horizontal(-k)];
};

/** A shaded system of two inequalities, drawn with its two boundary lines. */
export const systemGraph = (lines: Linear[], region: Linear[], xLabel: number, yLabel: number, size = 4) => (
  <Plot x={[-size, size]} y={[-size, size]} scale={12} lines={lines} region={region} xLabels={[[xLabel, n(xLabel)]]} yLabels={[[yLabel, n(yLabel)]]} />
);

export const tetrahedron = () => (
  <Geo
    width={190}
    pts={{S: [2.5, 4.4], P: [0, 1.6], Q: [5, 1.6], R: [1.8, 0]}}
    segs={['SP', 'SQ', 'SR', 'PR', 'QR', ['P', 'Q', 'dash']]}
    marks={[
      ['ticks', 'S', 'P', 2],
      ['ticks', 'S', 'Q', 2],
      ['ticks', 'S', 'R', 2],
      ['ticks', 'P', 'R', 2],
      ['ticks', 'Q', 'R', 2],
      ['ticks', 'P', 'Q', 2],
    ]}
  />
);

export const cylinder = (radius: string) => (
  <Geo
    width={150}
    pts={{T: [0, 5], O: [0, 0], L: [-2.5, 5], R: [2.5, 5], l: [-2.5, 0], r: [2.5, 0]}}
    ellipses={[
      {c: 'T', rx: 2.5, ry: 0.6},
      {c: 'O', rx: 2.5, ry: 0.6, dashBack: true},
    ]}
    segs={[['L', 'l'], ['R', 'r'], ['T', 'O'], ['O', 'r']]}
    labels={[['O', -6, 12]]}
    marks={[['len', 'O', 'r', radius, -1]]}
  />
);

export const cone = () => (
  <Geo
    width={170}
    pts={{S: [0, 5], O: [0, 0], A: [-3, 0], B: [3, 0]}}
    ellipses={[{c: 'O', rx: 3, ry: 0.7, dashBack: true}]}
    segs={['SA', 'SB', 'SO', 'AO']}
    labels={['S', ['A', -10, 2], ['B', 10, 2], ['O', 0, 18]]}
  />
);

export const box = () => (
  <Geo
    width={200}
    pts={{a: [0, 0], b: [4, 0], c: [4, 2.5], d: [0, 2.5], e: [6, 1.2], f: [6, 3.7], g: [2, 3.7]}}
    segs={[['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'], ['d', 'g'], ['g', 'f'], ['f', 'c'], ['b', 'e'], ['e', 'f']]}
  />
);

export const squareWithDiagonal = (diagonal: string) => (
  <Geo width={120} pts={{A: [0, 0], B: [4, 0], C: [4, 4], D: [0, 4]}} segs={['AB', 'BC', 'CD', 'DA', 'AC']} texts={[[[1.5, 2.6], diagonal]]} />
);

/** A cone cut through its apex: the hatched section SAB. */
export const coneSection = () => (
  <Geo
    width={170}
    pts={{S: [0, 5.2], O: [0, 0], A: [-3, 0], B: [3, 0]}}
    ellipses={[{c: 'O', rx: 3, ry: 0.7, dashBack: true}]}
    segs={['SA', 'SB', 'SO', 'AB']}
    hatch={['SAB']}
    labels={['S', ['A', -10, 2], ['B', 10, 2], ['O', 0, 8]]}
  />
);

/** A box with the diagonals of three faces drawn from one corner: left, front and bottom face. */
export const boxDiagonals = (left: string, front: string, bottom: string) => (
  <Geo
    width={220}
    pts={{a: [0, 0], b: [3.2, 0], c: [3.2, 4.6], d: [0, 4.6], e: [2.2, 1.5], f: [5.4, 1.5], g: [5.4, 6.1], h: [2.2, 6.1]}}
    segs={[
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'a'],
      ['d', 'h'],
      ['h', 'g'],
      ['g', 'c'],
      ['b', 'f'],
      ['f', 'g'],
      ['a', 'e', 'dash'],
      ['e', 'f', 'dash'],
      ['e', 'h', 'dash'],
      ['a', 'h'],
      ['a', 'c'],
      ['a', 'f'],
    ]}
    texts={[
      [[0.62, 3.6], left],
      [[2.7, 2.6], front],
      [[2.5, 0.3], bottom],
    ]}
  />
);

/**
 * y = kx² (or the cap y = k − kx²) with a hatched area, for "which area does ∫ kx² dx give?":
 * 'under' the curve, 'over' it (up to y = k), or the whole 'box' up to y = k; from x = `from` to x = 1.
 */
export const parabolaArea = (k: number, area: 'under' | 'over' | 'box', from: number, {half = false, cap = false} = {}) => {
  const f = cap ? (x: number) => k - k * x * x : (x: number) => (half && x < 0 ? NaN : k * x * x);
  const lo = area === 'over' ? f : () => 0;
  const hi = area === 'under' ? f : () => k;
  const frame: [[number, number], [number, number]][] = cap
    ? []
    : [
        [
          [from, k],
          [1, k],
        ],
        [
          [1, 0],
          [1, k],
        ],
        ...(from < 0
          ? [
              [
                [-1, 0],
                [-1, k],
              ] as [[number, number], [number, number]],
            ]
          : []),
      ];
  const ticks: [number, string][] = Array.from({length: k - 1}, (_, i) => [i + 1, '']);
  return (
    <Plot
      x={[half ? -0.5 : -1.4, 1.4]}
      y={[cap ? -1 : -0.4, k + 0.6]}
      scale={k === 2 ? 26 : 21}
      curve={f}
      fills={[{from, to: 1, lo, hi}]}
      dashed={frame}
      xLabels={from < 0 || cap ? [[-1, n(-1)], [1, '1']] : [[1, '1']]}
      yLabels={[[k, String(k)], ...ticks]}
      origin={half ? 'left' : 'below'}
    />
  );
};

// ---------------------------------------------------------------- Тест 4.А / 4.Б

const deg = (a: number): [number, number] => [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];

/** A rhombus ABCD with side `side` (its text on AB) and angle `angle`° at A. */
export const rhombus = (side: string, angle: number) => {
  const [c, s] = deg(angle);
  const a = 4;
  return (
    <Geo
      width={200}
      pts={{A: [0, 0], D: [a, 0], B: [a * c, a * s], C: [a * c + a, a * s]}}
      segs={['AB', 'BC', 'CD', 'DA']}
      labels={['A', 'B', 'C', 'D']}
      marks={[
        ['angle', 'A', 'D', 'B', `${angle}°`],
        ['len', 'A', 'B', side, -1],
      ]}
    />
  );
};

/**
 * A circle with centre O, the radii to two points and the inscribed angle at a third with its bisector: points by
 * their angle on the circle (degrees); `mark` the angle printed (at its vertex, between two rays).
 */
export const inscribed = (at: Record<string, number>, segs: string[], mark: [string, string, string, string], arc?: [string, string, string], text?: [[number, number], string]) => (
  <Geo
    width={190}
    pts={{O: [0, 0], ...Object.fromEntries(Object.entries(at).map(([k, a]) => [k, deg(a)]))}}
    ellipses={[{c: 'O', rx: 1, ry: 1}]}
    segs={segs}
    labels={[...Object.keys(at), ['O', 9, -8]]}
    marks={[['angle', ...mark] as ['angle', string, string, string, string], ...(arc ? [['angle', ...arc] as ['angle', string, string, string]] : [])]}
    texts={text ? [text] : []}
  />
);

/** "Which function's graph is it?": the parabola y = a(x − h)² + k with its vertex marked, and its cut with Oy. */
export const vertexParabola = (a: number, h: number, k: number, x: [number, number], y: [number, number], cut: number, origin: 'left' | 'below' = 'left') => (
  <Plot
    x={x}
    y={y}
    scale={22}
    origin={origin}
    curve={(v) => a * (v - h) ** 2 + k}
    dashed={[
      [
        [0, k],
        [h, k],
      ],
      [
        [h, 0],
        [h, k],
      ],
    ]}
    xLabels={[[h, String(h), k < 0 ? 'above' : undefined]]}
    yLabels={[
      [k, n(k)],
      [cut, n(cut)],
    ]}
  />
);

/**
 * A parallelogram ABCD (AD along the bottom) with its diagonals: the sides AB, AD, the diagonals' texts on BO and AO,
 * and the angle between them at O (between OC and OD).
 */
export const parallelogram = (ab: number, ad: number, ac: number, texts: {bd: string; ac: string; angle: string; o?: boolean}) => {
  // B = (p, h): |AB| = ab, |AC| = ac.
  const p = (ac * ac - ab * ab - ad * ad) / (2 * ad);
  const h = Math.sqrt(ab * ab - p * p);
  return (
    <Geo
      width={230}
      pts={{A: [0, 0], D: [ad, 0], B: [p, h], C: [p + ad, h], O: [(p + ad) / 2, h / 2]}}
      segs={['AB', 'BC', 'CD', 'DA', 'AC', 'BD']}
      labels={['A', 'B', 'C', 'D', ...(texts.o ? [['O', 0, 16] as [string, number, number]] : [])]}
      marks={[
        ['len', 'B', 'O', texts.bd, -1],
        ['len', 'A', 'O', texts.ac, -1],
        ['angle', 'O', 'D', 'C', texts.angle],
      ]}
    />
  );
};

/**
 * A triangle with two altitudes from `from` to their feet, meeting at O: points as worked out from the problem's
 * lengths; right angles at the feet; two lengths on the altitudes.
 */
export const altitudes = (pts: Record<string, [number, number]>, segs: string[], rights: [string, string, string][], lens: [string, string, string, number][]) => (
  <Geo
    width={220}
    pts={pts}
    segs={segs}
    labels={Object.keys(pts).map((k) => (k === 'O' ? (['O', -10, -5] as [string, number, number]) : k))}
    marks={[...rights.map((r) => ['right', ...r] as ['right', string, string, string]), ...lens.map(([a, b, t, side]) => ['len', a, b, t, side] as ['len', string, string, string, number])]}
  />
);

const PI = Math.PI;
const piText: Record<string, string> = {'-1.5': '−3π/2', '-1': '−π', '-0.5': '−π/2', '0.5': 'π/2', '1': 'π', '1.5': '3π/2'};

/**
 * y = sin x or y = cos x between y = −1 and y = 1, with the area between the curve and y = 1 over [0, π/2] hatched
 * (as "which integral gives the area?"). Ticks at the multiples of π/2 given (as their multiple; 'above': over the
 * axis, as the book prints them where the curve runs below); dashed drops from the curve's tops and bottoms to the axis.
 */
export const trigArea = (f: 'sin' | 'cos', from: number, ticks: [number, 'above'?][], drops: number[]) => {
  const fn = f === 'sin' ? Math.sin : Math.cos;
  return (
    <Plot
      x={[from * PI - 0.35, 1.5 * PI + 0.6]}
      y={[-1.5, 1.55]}
      scale={26}
      curve={fn}
      lines={[
        [0, 1, 1],
        [0, 1, -1],
      ]}
      fills={[{from: 0, to: PI / 2, lo: fn, hi: () => 1}]}
      dashed={drops.map((m) => [
        [m * PI, 0],
        [m * PI, fn(m * PI)],
      ])}
      xLabels={ticks.map(([m, side]) => [m * PI, piText[String(m)], side] as [number, string, 'above'?])}
      yLabels={[
        [1, '1'],
        [-1, '−1'],
      ]}
      origin={f === 'sin' ? false : 'below'}
    />
  );
};

/** A cylinder cut through its axis: the hatched square section with its diagonal (its text by it). */
export const cylinderSection = (diagonal: string) => (
  <Geo
    width={150}
    pts={{T: [0, 5], O: [0, 0], L: [-2.5, 5], R: [2.5, 5], l: [-2.5, 0], r: [2.5, 0]}}
    ellipses={[
      {c: 'T', rx: 2.5, ry: 0.6},
      {c: 'O', rx: 2.5, ry: 0.6, dashBack: true},
    ]}
    hatch={['LRrl']}
    segs={[['L', 'l'], ['R', 'r'], ['L', 'R'], ['l', 'r'], ['l', 'R']]}
    labels={[['O', 0, 16]]}
    texts={[[[-0.75, 3.1], diagonal]]}
  />
);
