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
