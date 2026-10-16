// A perfect score (every question right, with the whole key in): a rainbow card and confetti after a test, gold after
// an exam. The confetti plays once per result on a device; the colours stay whenever the result is opened.
import {Crown, Sparkles} from 'lucide-react';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import type {Grade} from '../lib/keys';

export type PerfectKind = 'test' | 'exam';

export const isPerfect = (g: Grade | null | undefined) => !!g && g.total === g.count && g.score === g.total;

const RAINBOW = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
const GOLD = ['#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#fff7d6'];

const LOOK = {
  test: {
    border: 'bg-[linear-gradient(90deg,#f87171,#fb923c,#facc15,#4ade80,#38bdf8,#818cf8,#c084fc,#f472b6,#f87171)]',
    glow: 'shadow-[0_0_48px_-12px_rgba(192,132,252,0.75)]',
    text: 'bg-[linear-gradient(90deg,#f87171,#fb923c,#facc15,#4ade80,#38bdf8,#818cf8,#c084fc,#f472b6,#f87171)]',
    chip: 'bg-[linear-gradient(90deg,#f87171,#facc15,#4ade80,#38bdf8,#c084fc)] text-black',
    colors: RAINBOW,
  },
  exam: {
    border: 'bg-[linear-gradient(90deg,#b45309,#f59e0b,#fde68a,#fbbf24,#b45309)]',
    glow: 'shadow-[0_0_48px_-12px_rgba(251,191,36,0.8)]',
    text: 'bg-[linear-gradient(90deg,#f59e0b,#fde68a,#fbbf24,#fff7d6,#f59e0b)]',
    chip: 'bg-[linear-gradient(90deg,#f59e0b,#fde68a,#fbbf24)] text-black',
    colors: GOLD,
  },
};

/** Classes for the score digits: a moving rainbow (or gold) fill. */
export const perfectText = (kind: PerfectKind) =>
  `${LOOK[kind].text} bg-[length:200%_auto] bg-clip-text text-transparent animate-[shimmer_3s_linear_infinite] motion-reduce:animate-none`;

/**
 * The card a result is shown in. For a perfect score: a moving coloured frame and a glow, and confetti the first time
 * this result is seen on this device.
 */
export function ResultCard({perfect, id, className = '', children}: {perfect: PerfectKind | null; id: string; className?: string; children: ReactNode}) {
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (perfect && firstTime(id)) setBurst(true);
  }, [perfect, id]);
  if (!perfect) return <div className={`rounded-2xl bg-neutral-900 p-5 ${className}`}>{children}</div>;
  return (
    <div className={`rounded-2xl p-[2px] ${LOOK[perfect].border} ${LOOK[perfect].glow} bg-[length:200%_100%] animate-[shimmer_4s_linear_infinite] motion-reduce:animate-none ${className}`}>
      <div className="rounded-[14px] bg-neutral-900 p-5">{children}</div>
      {burst && <Confetti colors={LOOK[perfect].colors} />}
    </div>
  );
}

/** The line above the score. */
export function PerfectTitle({kind}: {kind: PerfectKind}) {
  return (
    <p className="flex animate-[pop-in_.5s_ease-out] items-center gap-2 text-lg font-bold motion-reduce:animate-none">
      {kind === 'exam' ? <Crown size={22} className="text-amber-300" /> : <Sparkles size={22} className="text-fuchsia-300" />}
      <span className={perfectText(kind)}>{kind === 'exam' ? 'Шалгалтанд төгс оноо!' : 'Төгс оноо!'}</span>
      <span aria-hidden>{kind === 'exam' ? '🏆' : '🎉'}</span>
    </p>
  );
}

/** A small "Төгс" chip for lists of results. */
export function PerfectBadge({kind}: {kind: PerfectKind}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${LOOK[kind].chip}`}>
      {kind === 'exam' ? <Crown size={12} /> : <Sparkles size={12} />} Төгс
    </span>
  );
}

function firstTime(id: string) {
  const key = `batnab.perfect.${id}`;
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch {
    // storage blocked: celebrate anyway
  }
  return true;
}

/** Confetti over the whole screen for about three seconds, then gone. None with reduced motion. */
function Confetti({colors}: {colors: string[]}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (done) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const size = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    size();
    // Two bursts from the lower corners, and some falling from the top.
    const pieces = Array.from({length: 170}, (_, i) => {
      const side = i % 3;
      const top = side === 2;
      const left = side === 0;
      return {
        x: top ? Math.random() * innerWidth : (left ? 0.08 : 0.92) * innerWidth,
        y: top ? -20 - Math.random() * innerHeight * 0.4 : innerHeight * 0.8,
        vx: top ? (Math.random() - 0.5) * 2 : (left ? 1 : -1) * (3 + Math.random() * 7),
        vy: top ? 1 + Math.random() * 2 : -(10 + Math.random() * 9),
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 8,
        turn: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.35,
        sway: Math.random() * Math.PI * 2,
        round: i % 4 === 0,
        color: colors[i % colors.length],
      };
    });
    const start = performance.now();
    let last = start;
    let frame = 0;
    const tick = (now: number) => {
      const step = Math.min((now - last) / 16.7, 3);
      last = now;
      const age = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = Math.max(0, Math.min(1, 3.2 - age));
      for (const p of pieces) {
        p.vy = Math.min(p.vy + 0.32 * step, 5);
        p.vx *= 0.985 ** step;
        p.x += (p.vx + Math.sin(age * 4 + p.sway) * 0.8) * step;
        p.y += p.vy * step;
        p.turn += p.spin * step;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.turn);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.turn * 2)) + 1);
        ctx.restore();
      }
      if (age < 3.2) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    addEventListener('resize', size);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', size);
    };
  }, [colors, done]);
  if (done) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
