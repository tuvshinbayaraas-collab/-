import {Check, ChevronDown, Lock, Plus, Trash2, Users, X} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {
  CLOSED_SHOWN,
  closeClassPoll,
  createClassPoll,
  declineClassPoll,
  declinedOf,
  deleteClassPoll,
  freeSlot,
  MAX_CLASS_OPTIONS,
  tally,
  undeclineClassPoll,
  useClassPolls,
  useClassVotes,
  voteClassPoll,
  votesOf,
  type ClassPoll,
  type ClassVotes,
} from '../lib/classPolls';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {useFolded} from '../lib/fold';
import {Declined, FoldHead} from './Polls';
import {dayLabel, useNow} from '../lib/time';

/** Shown at first; the rest behind «Бүгдийг харах». */
const FIRST = 3;

const sorry = (e: unknown) => (/permission/i.test((e as Error).message) ? 'Илгээж чадсангүй: асуулга хаагдсан эсвэл устсан байж магадгүй.' : (e as Error).message);

/**
 * «Ангийн санал асуулга» on a student's home page: their class's polls, asked by classmates (who asked is not shown;
 * the teacher sees it), and their own (at most three at a time) — only a «Багшийн хариуцагч» (marked so by the
 * teacher) asks one; the others answer. Answered: how the class answered, never who.
 */
export default function ClassPolls({uid, classId}: {uid: string; classId?: string}) {
  const settings = useSettings();
  const lead = useSession().profile?.lead === true;
  const on = !!classId && !!settings && settings.studentPolls;
  const polls = useClassPolls(classId, on);
  const votes = useClassVotes(classId, on);
  const now = useNow(60_000);
  const [making, setMaking] = useState(false);
  const [all, setAll] = useState(false);
  // Said «Хариулахгүй» to on this visit: a line to take it back (next time, gone).
  const [justNo, setJustNo] = useState<string[]>([]);
  const [folded, fold] = useFolded('classPolls');
  if (!on || !polls || !votes) return null;
  const mine = polls.filter((p) => p.by === uid);
  // Classmates' open ones not answered yet first, then their own, then answered, then closed (for a few days; their
  // own stay till they delete them).
  const rank = (p: ClassPoll) => (p.closed ? 3 : votesOf(p, votes)[uid] ? 2 : p.by === uid ? 1 : 0);
  const no = (p: ClassPoll) => declinedOf(p, votes).includes(uid);
  const shown = polls.filter((p) => !no(p) && (p.by === uid || !p.closed || now - p.closed < CLOSED_SHOWN)).sort((a, b) => rank(a) - rank(b) || b.at - a.at);
  const undo = polls.filter((p) => no(p) && justNo.includes(p.id));
  const list = all ? shown : shown.slice(0, FIRST);
  const toAnswer = shown.filter((p) => rank(p) === 0).length;
  // Nothing to answer and not one who asks: no section.
  if (!lead && !shown.length && !undo.length) return null;
  return (
    <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Folds the whole section away (on this device); folded, how many are still to answer. */}
        <button type="button" onClick={fold} aria-expanded={!folded} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <h2 className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-sky-300">
            <Users size={14} /> Ангийн санал асуулга{shown.length ? ` (${shown.length})` : ''}
            {folded && toAnswer > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">{toAnswer} хариулаагүй</span>}
          </h2>
          <ChevronDown size={16} aria-hidden className={`ml-auto shrink-0 text-neutral-500 transition-transform ${folded ? '' : 'rotate-180'}`} />
        </button>
        {lead && !making && !folded && (
          <button type="button" onClick={() => setMaking(true)} className="ml-auto flex items-center gap-1 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-500/25">
            <Plus size={14} /> Асуулга гаргах
          </button>
        )}
      </div>
      {!folded && (
        <>
      {making && <NewPoll cls={classId!} slot={freeSlot(mine)} onClose={() => setMaking(false)} />}
      {lead && !shown.length && !making && <p className="mt-1.5 text-sm text-neutral-400">Ангийнхнаасаа асуух зүйл байна уу? Асуулга гаргавал ангийнхан чинь сонголтоо хийнэ.</p>}
      {list.length > 0 && (
        <ul className="mt-3 space-y-3">
          {list.map((p) => (
            <Card key={`${p.by}/${p.slot}/${p.id}`} poll={p} uid={uid} votes={votes} onDeclined={() => setJustNo([...justNo, p.id])} />
          ))}
        </ul>
      )}
      {undo.length > 0 && (
        <div className="mt-3 space-y-2">
          {undo.map((p) => (
            <Declined key={p.id} q={p.q} tone="sky" onUndo={() => undeclineClassPoll(p).then(() => setJustNo(justNo.filter((x) => x !== p.id)))} />
          ))}
        </div>
      )}
      {shown.length > FIRST && (
        <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
          <ChevronDown size={14} className={`transition-transform ${all ? 'rotate-180' : ''}`} /> {all ? 'Цөөнийг харуулах' : `Бүгдийг харах (${shown.length})`}
        </button>
      )}
        </>
      )}
    </section>
  );
}

function NewPoll({cls, slot, onClose}: {cls: string; slot: string | null; onClose: () => void}) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filled = options.filter((o) => o.trim());
  const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 text-sm outline-none focus:border-sky-400';
  if (!slot)
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-neutral-900/70 px-3 py-2.5 text-sm text-neutral-300">
        <span className="min-w-0 flex-1">Танд 3 асуулга байна. Шинийг гаргахын тулд нэгийг нь устгана уу.</span>
        <button type="button" onClick={onClose} aria-label="Хаах" className="-m-1 rounded-full p-1 text-neutral-400 hover:bg-neutral-800">
          <X size={16} />
        </button>
      </div>
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createClassPoll(cls, slot, {q, options: filled, multi});
      onClose();
    } catch (err) {
      setError(/permission/i.test((err as Error).message) ? 'Илгээж чадсангүй. Хуудсаа дахин ачаалаад оролдоно уу.' : (err as Error).message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl bg-neutral-900/70 p-3">
      <textarea value={q} maxLength={200} rows={2} onChange={(e) => setQ(e.target.value)} placeholder="Асуулт, жишээ нь: Баасан гарагт ямар сэдвээр тэмцээн хийх вэ?" aria-label="Асуулт" className={`${field} resize-y py-2`} />
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-right text-xs text-neutral-500">{i + 1}.</span>
          <input value={o} maxLength={80} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Сонголт" aria-label={`${i + 1}-р сонголт`} className={`${field} py-1.5`} />
          {options.length > 2 && (
            <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Сонголт хасах" className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
              <X size={15} />
            </button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {options.length < MAX_CLASS_OPTIONS && (
          <button type="button" onClick={() => setOptions([...options, ''])} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/10">
            <Plus size={13} /> Сонголт нэмэх
          </button>
        )}
        {filled.length > 2 && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="h-4 w-4 accent-sky-500" /> Хэд хэдийг сонгож болно
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy || !q.trim() || filled.length < 2} className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50">
          {busy ? 'Илгээж байна…' : 'Илгээх'}
        </button>
        <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800">
          Болих
        </button>
      </div>
      <p className="text-xs text-neutral-500">Ангийнхан тань хэн гаргасныг харахгүй, багш харна. Зэрэг 3 хүртэл асуулга гаргаж болно.</p>
    </form>
  );
}

function Card({poll, uid, votes, onDeclined}: {poll: ClassPoll; uid: string; votes: ClassVotes; onDeclined: () => void}) {
  const had = votesOf(poll, votes)[uid] ?? null;
  const {voters, counts} = tally(poll, votes);
  const own = poll.by === uid;
  const [folded, fold] = useFolded(`cpoll:${poll.id}`);
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosen = picked ?? had ?? [];
  const asking = !poll.closed && (!had || editing);
  const toggle = (i: number) => setPicked(poll.multi ? (chosen.includes(i) ? chosen.filter((x) => x !== i) : [...chosen, i].sort((a, b) => a - b)) : [i]);
  const act = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await f();
      return true;
    } catch (e) {
      setError(sorry(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (await act(() => voteClassPoll(poll, chosen))) {
      setEditing(false);
      setPicked(null);
    }
  };
  const top = Math.max(0, ...counts);
  return (
    <li className="rounded-xl bg-neutral-900/70 p-3">
      <FoldHead folded={folded} onFold={fold} q={poll.q} status={had ? 'Хариулсан' : poll.closed ? 'Хаагдсан' : 'Хариулаагүй'} done={!!had || poll.closed > 0} tone="sky">
        <span className={`font-normal ${own ? 'font-semibold text-sky-300' : 'text-neutral-400'}`}>{own ? 'Таны асуулга' : 'Ангийн сурагч'}</span>
        <span className="font-normal text-neutral-400">· {dayLabel(poll.at)}</span>
        {poll.multi && asking && !folded && <span className="font-normal text-neutral-400">· хэдийг ч сонгож болно</span>}
        {poll.closed > 0 && !folded && (
          <span className="flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
            <Lock size={11} /> Хаагдсан
          </span>
        )}
      </FoldHead>
      {folded ? null : asking ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-col gap-1.5" role={poll.multi ? 'group' : 'radiogroup'} aria-label={poll.q}>
            {poll.options.map((o, i) => {
              const on = chosen.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  role={poll.multi ? 'checkbox' : 'radio'}
                  aria-checked={on}
                  onClick={() => toggle(i)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${on ? 'border-sky-400 bg-sky-500/20 text-neutral-50' : 'border-neutral-700 bg-neutral-950/60 text-neutral-200 hover:border-neutral-500'}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${poll.multi ? 'rounded-md' : 'rounded-full'} ${on ? 'border-sky-400 bg-sky-400 text-black' : 'border-neutral-500'}`}>
                    {on && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 break-words">{o}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={send} disabled={busy || !chosen.length} className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50">
              {busy ? 'Илгээж байна…' : had ? 'Шинэчлэх' : 'Илгээх'}
            </button>
            {had && (
              <button type="button" onClick={() => (setEditing(false), setPicked(null))} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800">
                Болих
              </button>
            )}
            {!had && !own && (
              <button type="button" disabled={busy} onClick={() => void act(() => declineClassPoll(poll)).then((ok) => ok && onDeclined())} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
                Хариулахгүй
              </button>
            )}
            <span className="text-xs text-neutral-500">{voters ? `${voters} хүн хариулсан · ` : ''}Хариулсны дараа дүн нь харагдана.</span>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {poll.options.map((o, i) => {
              const pct = voters ? Math.round((counts[i] / voters) * 100) : 0;
              const me = had?.includes(i);
              return (
                <li key={i} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`flex min-w-[8rem] flex-1 items-center gap-1 break-words ${counts[i] === top && top > 0 ? 'font-semibold' : ''}`}>
                      {me && <Check size={14} className="shrink-0 text-sky-300" aria-label="Таны сонголт" />}
                      {o}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums text-neutral-400">
                      {counts[i]} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                    <div className={`h-full rounded-full ${me ? 'bg-sky-300' : 'bg-sky-500/70'}`} style={{width: `${pct}%`}} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-xs text-neutral-500">{voters ? `${voters} хүн хариулсан` : 'Одоохондоо хариулсан хүн алга'}</p>
        </>
      )}
      {!folded && error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      {!folded && (own || (had && !asking && !poll.closed)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          {had && !asking && !poll.closed && (
            <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
              <ChevronDown size={13} /> Өөрчлөх
            </button>
          )}
          {own && !poll.closed && (
            <button type="button" disabled={busy} onClick={() => confirm('Асуулгыг хаах уу? Хаасны дараа хэн ч сонголт хийж, өөрчлөхгүй.') && act(() => closeClassPoll(poll))} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
              <Lock size={13} /> Хаах
            </button>
          )}
          {own && (
            <button type="button" disabled={busy} onClick={() => confirm('Асуулгыг хариултуудтай нь устгах уу?') && act(() => deleteClassPoll(poll))} className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
              <Trash2 size={13} /> Устгах
            </button>
          )}
        </div>
      )}
    </li>
  );
}
