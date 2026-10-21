import {Check, ChevronDown, MessageSquare, X} from 'lucide-react';
import {useRef, useState} from 'react';
import {Rich, TopicPicture} from '../../components/TopicParts';
import {LETTER_CODES, LETTER_LABELS, normalize, problemNo, setMarks, verdict, type Letter, type Mark, type Marks, type Problem, type Progress, type Topic} from '../../lib/topics';
import type {Student} from './data';

/** An answer the teacher looks at: whose, what they wrote, and how it stands. */
interface Entry {
  s: Student;
  a: string;
  mark?: Mark;
  v: boolean | null;
}

/** Problems whose answers a teacher checks: those without a key, and written answers (put another way than the key). */
export const checked = (p: Problem, key?: string) => !key || p.kind === 'answer';

/** How many answers wait for the teacher in this topic, among these students. */
export function waitingIn(topic: Topic, students: Student[], progress: Record<string, Progress>, marks: Record<string, Marks>, keys: Record<string, string>) {
  let n = 0;
  for (const s of students)
    for (const p of topic.problems) {
      const a = progress[s.uid]?.[topic.id]?.[p.id];
      if (a && verdict(a.a, keys[p.id], marks[s.uid]?.[topic.id]?.[p.id]) === null) n++;
    }
  return n;
}

/**
 * "Шалгах": the students' answers to the problems the teacher checks, the same answers together, so a whole group is
 * marked right or wrong at once (or one student, with a note). For an А–Д problem the right letter can simply be
 * picked: it becomes the key and every answer is checked by it.
 */
export default function TopicCheck(props: {topic: Topic; students: Student[]; progress: Record<string, Progress>; marks: Record<string, Marks>; keys: Record<string, string>; onKey: (pid: string, key: string) => void}) {
  const {topic, students, progress, marks, keys, onKey} = props;
  const [all, setAll] = useState(false);
  const [error, setError] = useState('');
  // A problem that had answers waiting stays here once they're marked (to undo a tap, or add a note).
  const seen = useRef(new Set<string>());

  const list = topic.problems
    .map((p, i) => {
      const entries: Entry[] = students.flatMap((s) => {
        const a = progress[s.uid]?.[topic.id]?.[p.id]?.a;
        if (!a) return [];
        const mark = marks[s.uid]?.[topic.id]?.[p.id];
        return [{s, a, mark, v: verdict(a, keys[p.id], mark)}];
      });
      return {p, i, entries, waiting: entries.filter((e) => e.v === null).length};
    })
    .filter(({p, entries, waiting}) => {
      if (waiting) seen.current.add(p.id);
      return entries.length && (waiting || seen.current.has(p.id) || (all && checked(p, keys[p.id])));
    });
  const total = list.reduce((a, x) => a + x.waiting, 0);
  const mark = (uids: string[], pid: string, ok: boolean | null, note?: string) => {
    setError('');
    setMarks(uids, topic.id, pid, ok, note).catch((e) => setError(`Хадгалж чадсангүй: ${(e as Error).message}`));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-neutral-300">
          {total ? (
            <>
              <span className="font-semibold text-violet-200">{total} хариулт</span> таныг шалгахыг хүлээж байна. Ижил хариултууд нэг мөрөнд: нэг товшилтоор бүгдийг нь шалгана.
            </>
          ) : (
            'Шалгах хариулт алга.'
          )}
        </p>
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-blue-500" />
          Шалгаснаа ч харах
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!list.length && (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">
          {all ? 'Сурагчид хариулт илгээгээгүй байна.' : 'Бүх хариултыг шалгасан. Хариултгүй (түлхүүргүй) бодлогын хариулт энд ирнэ.'}
        </p>
      )}
      {list.map(({p, i, entries, waiting}) => (
        <ProblemCheck key={p.id} topic={topic} p={p} no={problemNo(p, i)} entries={entries} waiting={waiting} keyed={keys[p.id]} onKey={(k) => onKey(p.id, k)} onMark={(uids, ok, note) => mark(uids, p.id, ok, note)} />
      ))}
    </div>
  );
}

function ProblemCheck(props: {topic: Topic; p: Problem; no: number; entries: Entry[]; waiting: number; keyed?: string; onKey: (k: string) => void; onMark: (uids: string[], ok: boolean | null, note?: string) => void}) {
  const {topic, p, no, entries, waiting, keyed, onKey, onMark} = props;
  // The same answer together (written ones compared as the key would be).
  const by = new Map<string, Entry[]>();
  for (const e of entries) {
    const g = p.kind === 'choice' ? e.a : normalize(e.a);
    by.set(g, [...(by.get(g) ?? []), e]);
  }
  const groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{no}-р бодлого</h3>
        {waiting > 0 ? <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-200">{waiting} шалгах</span> : <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-300">шалгасан</span>}
        <span className="text-xs text-neutral-500">{entries.length} хариулт</span>
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0">
          {p.text && <Rich text={p.text} className="text-sm" />}
          {p.img && <TopicPicture tid={topic.id} iid={p.img} className="mt-2 w-full [&_img]:max-h-56" />}
          {p.kind === 'choice' && (
            <div className="mt-3">
              <p className="text-xs text-neutral-400">{keyed ? 'Зөв хариулт:' : 'Зөв хариултыг сонговол бүх хариулт өөрөө шалгагдана:'}</p>
              <div className="mt-1 flex gap-1.5">
                {LETTER_CODES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => onKey(l)}
                    aria-pressed={keyed === l}
                    aria-label={`${LETTER_LABELS[l]} зөв`}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${keyed === l ? 'bg-green-500 text-black' : 'bg-neutral-800 hover:bg-neutral-700'}`}
                  >
                    {LETTER_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <ul className="min-w-0 space-y-2">
          {groups.map(([g, es]) => (
            <Group key={g} p={p} entries={es} onMark={onMark} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Group({p, entries, onMark}: {p: Problem; entries: Entry[]; onMark: (uids: string[], ok: boolean | null, note?: string) => void}) {
  const [open, setOpen] = useState(false);
  const shown = p.kind === 'choice' ? (LETTER_LABELS[entries[0].a as Letter] ?? entries[0].a) : entries[0].a;
  const all = (v: boolean | null) => entries.every((e) => e.v === v);
  const set = (ok: boolean) => {
    // Marked so already by the teacher: a second tap takes the marks back.
    const undo = entries.every((e) => e.mark?.ok === ok);
    onMark(
      entries.map((e) => e.s.uid),
      undo ? null : ok,
    );
  };
  const tone = all(true) ? 'border-green-500/50' : all(false) ? 'border-red-500/50' : entries.some((e) => e.v === null) ? 'border-violet-400/60' : 'border-neutral-700';
  return (
    <li className={`rounded-xl border bg-neutral-950/40 ${tone}`}>
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <span className={`min-w-0 max-w-full px-1 font-semibold [overflow-wrap:anywhere] ${p.kind === 'choice' ? 'text-lg' : 'whitespace-pre-wrap text-sm'}`}>{shown}</span>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200">
          <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="truncate">
            {entries.length} сурагч: {entries.map((e) => e.s.profile.name).join(', ')}
          </span>
        </button>
        <span className="ml-auto flex shrink-0 gap-1.5">
          <Verdict on={all(true)} ok onClick={() => set(true)} label={entries.length > 1 ? 'Бүгд зөв' : 'Зөв'} />
          <Verdict on={all(false)} onClick={() => set(false)} label={entries.length > 1 ? 'Бүгд буруу' : 'Буруу'} />
        </span>
      </div>
      {open && (
        <ul className="divide-y divide-neutral-800 border-t border-neutral-800">
          {entries.map((e) => (
            <Person key={e.s.uid} p={p} e={e} onMark={(ok, note) => onMark([e.s.uid], ok, note)} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Person({p, e, onMark}: {p: Problem; e: Entry; onMark: (ok: boolean | null, note?: string) => void}) {
  const [note, setNote] = useState(e.mark?.note ?? '');
  const [writing, setWriting] = useState(false);
  const saveNote = () => {
    setWriting(false);
    if (e.mark && note.trim() !== (e.mark.note ?? '')) onMark(e.mark.ok, note);
  };
  return (
    <li className="px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm">{e.s.profile.name}</span>
        {p.kind === 'answer' && <span className="max-w-full whitespace-pre-wrap text-xs text-neutral-400 [overflow-wrap:anywhere]">{e.a}</span>}
        <span className="flex shrink-0 gap-1">
          <Verdict small on={e.v === true} ok onClick={() => onMark(e.mark?.ok === true ? null : true, note)} label="Зөв" />
          <Verdict small on={e.v === false} onClick={() => onMark(e.mark?.ok === false ? null : false, note)} label="Буруу" />
          <button type="button" onClick={() => setWriting(!writing)} disabled={!e.mark} title={e.mark ? 'Тайлбар' : 'Эхлээд зөв, бурууг нь сонгоно'} aria-label="Тайлбар" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 disabled:opacity-30">
            <MessageSquare size={15} />
          </button>
        </span>
      </div>
      {e.mark?.note && !writing && <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-400">“{e.mark.note}”</p>}
      {writing && (
        <input
          autoFocus
          value={note}
          maxLength={300}
          onChange={(x) => setNote(x.target.value)}
          onBlur={saveNote}
          onKeyDown={(x) => x.key === 'Enter' && saveNote()}
          placeholder="Сурагчид харагдах тайлбар (заавал биш)"
          className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
        />
      )}
    </li>
  );
}

function Verdict({on, ok, small, label, onClick}: {on: boolean; ok?: boolean; small?: boolean; label: string; onClick: () => void}) {
  const tone = ok ? (on ? 'bg-green-500 text-black' : 'bg-neutral-800 text-green-300 hover:bg-green-500/20') : on ? 'bg-red-500 text-black' : 'bg-neutral-800 text-red-300 hover:bg-red-500/20';
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} title={label} className={`flex items-center gap-1 rounded-full font-medium ${small ? 'p-1.5' : 'px-3 py-1.5 text-sm'} ${tone}`}>
      {ok ? <Check size={small ? 14 : 15} /> : <X size={small ? 14 : 15} />}
      {!small && label}
    </button>
  );
}
