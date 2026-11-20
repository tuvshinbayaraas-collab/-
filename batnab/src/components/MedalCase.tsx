import {useState} from 'react';
import {animalOf, medalName, medalPeriod, PLACES, type Medal} from '../lib/leaderboard';
import {kindOf, medalFor, type MedalKind} from '../lib/medals';
import MedalBadge, {Art, METAL, testTitle} from './MedalBadge';
import Sheet from './Sheet';

const KINDS: [MedalKind | 'all', string][] = [
  ['all', 'Бүгд'],
  ['test', 'Тест'],
  ['order', 'Одон'],
  ['game', 'Тоглоом'],
];
/** What a kind of medal is called on its card. */
export const KIND_NAMES: Record<MedalKind, string> = {test: 'Тестийн медаль', order: 'Шилдэгийн одон', game: 'Тоглоомын медаль'};
/** How many show before «Бүгдийг харах». */
const FIRST = 6;

/** How a medal is won, in a sentence, for its card. */
export function howWon(m: Medal) {
  if (m.game) return `14 хоногийн шилдэг оноогоор ${m.place}-р байр. Тоглоом бүрийн эхний гурав 14 хоног тутам медаль авдаг.`;
  if (m.top) return `Долоо хоногт өгсөн тест бүрийн хамгийн сайн оноог нэмээд ${m.place}-р байр. Шилдэг оноогоор эхний гурав одон авдаг.`;
  const week = m.round ? `${animalOf(m.round)[1]} долоо хоног (№${m.round}). ` : '';
  return `${week}Тест бүрийн долоо хоногийн эхний гурав медаль авдаг.`;
}

/**
 * A student's medals: how many of each metal, a filter by kind (when there are more kinds than one), the newest first
 * (the first six, then all), each opening a card that says what it is for. `detail` shows what each was for under it.
 */
export default function MedalCase({medals, detail}: {medals: Medal[]; detail?: boolean}) {
  const [kind, setKind] = useState<MedalKind | 'all'>('all');
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Medal | null>(null);
  const of = (k: MedalKind | 'all') => (k === 'all' ? medals : medals.filter((m) => kindOf(m) === k));
  const kinds = KINDS.filter(([k]) => of(k).length > 0);
  const shown = of(kinds.some(([k]) => k === kind) ? kind : 'all');
  const list = all ? shown : shown.slice(0, FIRST);
  return (
    <>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Медалийн тоо">
        {([1, 2, 3] as const).map((p) => (
          <li key={p} className="flex items-center gap-1.5" data-metal={p}>
            <span className="h-3 w-3 rounded-full" style={{background: `radial-gradient(circle at 35% 30%, ${METAL[p].hi}, ${METAL[p].lo} 70%, ${METAL[p].rim})`}} aria-hidden />
            <span className={PLACES[p].text}>{PLACES[p].name}</span>
            <b className="text-neutral-100">{medals.filter((m) => m.place === p).length}</b>
          </li>
        ))}
      </ul>
      {kinds.length > 2 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Медалийн төрөл">
          {kinds.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setAll(false);
              }}
              className={`rounded-full border px-3 py-1 text-sm ${kind === k ? 'border-amber-400 bg-amber-500/15 text-amber-100' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}
              data-medal-kind={k}
            >
              {label} <span className={kind === k ? 'text-amber-200' : 'text-neutral-400'}>{of(k).length}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {list.map((m) => (
          <MedalBadge key={m.key} m={m} detail={detail} onOpen={setOpen} />
        ))}
      </ul>
      {shown.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          aria-expanded={all}
          className="mt-3 w-full rounded-xl border border-neutral-700 py-2 text-sm font-medium text-neutral-300 hover:border-neutral-500"
          data-medal-more
        >
          {all ? 'Хураах' : `Бүгдийг харах (${shown.length})`}
        </button>
      )}
      {open && <MedalCard m={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** One medal's card: the medal large, its name, place, what for, when, and how such medals are won. */
export function MedalCard({m, onClose}: {m: Medal; onClose: () => void}) {
  return (
    <Sheet title={medalName(m)} sub={KIND_NAMES[kindOf(m)]} onClose={onClose}>
      <div className="flex flex-col items-center pb-2 text-center" data-medal-card={m.key}>
        <span className="relative flex items-center justify-center">
          <span className={`absolute h-28 w-28 rounded-full blur-2xl ${PLACES[m.place].block}`} aria-hidden />
          <span className="relative motion-safe:animate-[medal-in_.45s_ease-out]">
            <Art m={m} size={112} />
          </span>
        </span>
        <p className={`mt-3 text-lg font-bold ${PLACES[m.place].text}`}>{m.place}-р байр</p>
        <p className="font-medium text-neutral-100">{medalFor(m, testTitle)}</p>
        <p className="text-sm text-neutral-400">{medalPeriod(m)}</p>
        <p className="mt-3 max-w-xs text-sm text-neutral-300">{howWon(m)}</p>
      </div>
    </Sheet>
  );
}
