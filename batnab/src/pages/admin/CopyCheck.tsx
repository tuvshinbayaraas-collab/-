import {ChevronDown, Copy} from 'lucide-react';
import {useState} from 'react';
import {formatDuration} from '../../lib/attempt';
import {copyPairs, type CopyPair, type Sheet} from '../../lib/copycheck';
import {choiceAt} from '../../lib/keys';
import {Link} from '../../lib/router';
import {LETTERS} from '../../tests/types';
import type {Student} from './data';

/**
 * "Ижил хариулт": pairs of students who share many wrong choices, more than chance or a common mistake explains; each
 * opens into the questions side by side. `review(uid)`: where that student's answers are looked at.
 */
export default function CopyCheck({sheets, keyed, count, students, review}: {sheets: Sheet[]; keyed: string | undefined; count: number; students: Student[]; review: (uid: string) => string}) {
  const [open, setOpen] = useState<string | null>(null);
  const names = new Map(students.map((s) => [s.uid, s.profile.name]));
  if (!keyed) return <p className="rounded-2xl bg-neutral-900 p-5 text-sm text-neutral-400">Түлхүүр оруулсны дараа ижил буруу хариултуудыг шалгана.</p>;
  const pairs = copyPairs(sheets, keyed, count);
  const byUid = new Map(sheets.map((s) => [s.uid, s]));
  return (
    <section className="space-y-3">
      <p className="text-sm text-neutral-400">
        Ангийн бусад нь бараг сонгоогүй ижил буруу хариултыг олон бодлогод сонгосон хосууд (нийтлэг андуурлыг тооцохгүй). Энэ нь зөвхөн сэрэмжлүүлэг: хамт давтсан найзууд ч адилхан
        байж болно.
      </p>
      {!pairs.length ? (
        <p className="rounded-2xl bg-neutral-900 p-5 text-sm text-neutral-300">Сэжигтэй ижил хариулт олдсонгүй ({sheets.length} сурагчийн хариулт).</p>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
          {pairs.map((p) => {
            const id = `${p.a}/${p.b}`;
            const isOpen = open === id;
            return (
              <li key={id}>
                <button type="button" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-neutral-800/40">
                  <Copy size={16} className="shrink-0 text-amber-300" />
                  <span className="min-w-0 flex-1 font-medium">
                    {names.get(p.a) ?? '?'} <span className="text-neutral-500">ба</span> {names.get(p.b) ?? '?'}
                  </span>
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300" title="Хоёулаа алдсан бодлогуудаас ижил буруу хариулт сонгосон нь">
                    {p.sameWrong.length}/{p.bothWrong} ижил буруу
                  </span>
                  {p.rare.length > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300" title="Ангийн бусад нь бараг сонгоогүй буруу хариулт">
                      {p.rare.length} ховор
                    </span>
                  )}
                  <span className="text-xs text-neutral-500">
                    {Math.round((p.same / Math.max(1, p.both)) * 100)}% ижил{p.apart !== undefined ? ` • ${formatDuration(p.apart / 1000)} зөрүүтэй дуусгасан` : ''}
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <Compare pair={p} a={byUid.get(p.a)!} b={byUid.get(p.b)!} keyed={keyed} count={count} names={names} review={review} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The two students' answers question by question: the same wrong ones in red (rare ones marked). */
function Compare({pair, a, b, keyed, count, names, review}: {pair: CopyPair; a: Sheet; b: Sheet; keyed: string; count: number; names: Map<string, string>; review: (uid: string) => string}) {
  const letter = (c: number | null) => (c === null ? '–' : LETTERS[c]);
  const rare = new Set(pair.rare);
  const sameWrong = new Set(pair.sameWrong);
  return (
    <div className="space-y-3 border-t border-neutral-800 px-4 pb-4 pt-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5">
        {Array.from({length: count}, (_, q) => {
          const x = choiceAt(a.answers, q);
          const y = choiceAt(b.answers, q);
          const k = choiceAt(keyed, q);
          const tone = sameWrong.has(q) ? (rare.has(q) ? 'bg-red-500/30 text-red-100 ring-1 ring-red-400' : 'bg-red-500/15 text-red-200') : x !== null && x === y && x === k ? 'bg-green-500/10 text-green-300' : 'bg-neutral-800/60 text-neutral-400';
          return (
            <div key={q} className={`rounded-lg px-1 py-1 text-center text-xs tabular-nums ${tone}`} title={`${q + 1}-р бодлого: ${letter(x)} / ${letter(y)}, зөв нь ${letter(k)}`}>
              <span className="block text-[10px] opacity-70">{q + 1}</span>
              <span className="font-semibold">
                {letter(x)}
                {x === y ? '' : `·${letter(y)}`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-3 text-xs text-neutral-500">
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-500/30 ring-1 ring-red-400" /> ижил, ховор буруу
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-500/15" /> ижил буруу
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-green-500/10" /> хоёулаа зөв
        </span>
        <span>«Б·В»: ялгаатай</span>
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        {[pair.a, pair.b].map((uid) => (
          <Link key={uid} href={review(uid)} className="rounded-full bg-neutral-800 px-3 py-1.5 hover:bg-neutral-700">
            {names.get(uid) ?? '?'}-ийн хариулт
          </Link>
        ))}
      </div>
    </div>
  );
}
