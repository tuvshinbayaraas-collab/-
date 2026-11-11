import {Check, ChevronDown, Lightbulb, Plus, Vote as VoteIcon, X} from 'lucide-react';
import {useState, type FormEvent, type ReactNode} from 'react';
import {forClass} from '../lib/live';
import {addIdea, decline, deleteIdea, entries, IDEAS_EACH, pickers, picks, savePicks, TOP, undecline, useIdeas, useMyVote, usePicks, usePolls, vote, type Entry, type Poll} from '../lib/polls';
import {dayLabel} from '../lib/time';

/** An ideas poll's lines shown at first; the rest behind «Бүгдийг харах». */
const FIRST = 8;

const sorry = (e: unknown) => (/permission/i.test((e as Error).message) ? 'Илгээж чадсангүй: асуулга хаагдсан байж магадгүй.' : (e as Error).message);

/** The teacher's open polls for the student's class, on their home page: answered, one line (and «Өөрчлөх»). */
export default function Polls({uid, classId}: {uid: string; classId?: string}) {
  const polls = usePolls();
  const mine = (polls ?? []).filter((p) => !p.closed && forClass(p.classes, classId));
  if (!mine.length) return null;
  return (
    <>
      {mine.map((p) => (p.ideas ? <IdeasCard key={p.id} poll={p} uid={uid} /> : <PollCard key={p.id} poll={p} uid={uid} />))}
    </>
  );
}

/** Said «Хариулахгүй» just now: a line to take it back (gone from the page next time). */
export function Declined({q, onUndo, tone = 'violet'}: {q: string; onUndo: () => Promise<unknown>; tone?: 'violet' | 'sky'}) {
  const [busy, setBusy] = useState(false);
  return (
    <p className={`flex items-center gap-2 rounded-2xl border border-dashed px-4 py-2.5 text-sm text-neutral-400 ${tone === 'sky' ? 'border-sky-500/30' : 'border-violet-500/30'}`}>
      <span className="min-w-0 flex-1 truncate">
        «{q}» — хариулахгүй гэж тэмдэглэлээ.
      </span>
      <button type="button" disabled={busy} onClick={() => (setBusy(true), onUndo().finally(() => setBusy(false)))} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800">
        Буцаах
      </button>
    </p>
  );
}

/** «Хариулахгүй» beside the send button. */
function DeclineButton({onClick, busy}: {onClick: () => void; busy: boolean}) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
      Хариулахгүй
    </button>
  );
}

function PollCard({poll, uid}: {poll: Poll; uid: string}) {
  const mine = useMyVote(poll.id, uid);
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<number[] | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justDeclined, setJustDeclined] = useState(false);
  // Until changed here: what they answered before («Хариулахгүй» is no answer).
  const had = mine && !mine.no ? mine : null;
  const chosen = picked ?? had?.c ?? [];
  const written = text ?? had?.t ?? '';
  const done = !!had && !editing;
  const ready = chosen.length > 0 || (!poll.options.length && written.trim().length > 0);
  const toggle = (i: number) => setPicked(poll.multi ? (chosen.includes(i) ? chosen.filter((x) => x !== i) : [...chosen, i].sort((a, b) => a - b)) : [i]);
  const run = async (f: () => Promise<unknown>) => {
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
    if (await run(() => vote(poll.id, chosen, poll.comment ? written : ''))) {
      setEditing(false);
      setPicked(null);
      setText(null);
    }
  };
  if (mine === null) return null;
  if (mine && mine.no) return justDeclined ? <Declined q={poll.q} onUndo={() => undecline(poll.id).then(() => setJustDeclined(false))} /> : null;
  return (
    <section className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-300">
        <VoteIcon size={14} /> Санал асуулга · {dayLabel(poll.at)}
        {poll.multi && !done && <span className="font-normal text-violet-300/80">· хэдийг ч сонгож болно</span>}
      </p>
      <p className="mt-1 whitespace-pre-wrap font-medium text-neutral-100 [overflow-wrap:anywhere]">{poll.q}</p>
      {done ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1 text-green-300">
            <Check size={16} /> Илгээсэн{had!.c.length ? `: ${had!.c.map((i) => poll.options[i]).filter(Boolean).join(', ')}` : ''}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
            <ChevronDown size={13} /> Өөрчлөх
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {poll.options.length > 0 && (
            <div className="flex flex-col gap-1.5" role={poll.multi ? 'group' : 'radiogroup'} aria-label={poll.q}>
              {poll.options.map((o, i) => (
                <Choice key={i} text={o} on={chosen.includes(i)} multi={poll.multi} onClick={() => toggle(i)} />
              ))}
            </div>
          )}
          {poll.comment && (
            <textarea
              value={written}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              rows={2}
              placeholder={poll.options.length ? 'Санаагаа бичиж болно (заавал биш)' : 'Хариултаа бичнэ үү'}
              aria-label="Таны санаа"
              className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={send} disabled={busy || !ready} className="rounded-full bg-violet-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-violet-400 disabled:opacity-50">
              {busy ? 'Илгээж байна…' : had ? 'Шинэчлэх' : 'Илгээх'}
            </button>
            {had ? (
              <button type="button" onClick={() => (setEditing(false), setPicked(null), setText(null))} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800">
                Болих
              </button>
            ) : (
              <DeclineButton busy={busy} onClick={() => void run(() => decline(poll.id)).then((ok) => ok && setJustDeclined(true))} />
            )}
            <span className="text-xs text-neutral-500">Таны хариуг зөвхөн багш харна.</span>
          </div>
        </div>
      )}
    </section>
  );
}

function Choice({text, on, multi, onClick, disabled, children}: {text: string; on: boolean; multi: boolean; onClick: () => void; disabled?: boolean; children?: ReactNode}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-wait ${on ? 'border-violet-400 bg-violet-500/20 text-neutral-50' : 'border-neutral-700 bg-neutral-900/60 text-neutral-200 hover:border-neutral-500'}`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${multi ? 'rounded-md' : 'rounded-full'} ${on ? 'border-violet-400 bg-violet-400 text-black' : 'border-neutral-500'}`}>
        {on && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{text}</span>
      {children}
    </button>
  );
}

/**
 * An ideas poll: the teacher's options and the students' ideas, each with how many picked it (most first, the top five
 * numbered); a tap picks or unpicks one at once. A student adds up to three ideas (who added one is not shown) and
 * may write to the teacher alone, if the poll asks.
 */
function IdeasCard({poll, uid}: {poll: Poll; uid: string}) {
  const mine = useMyVote(poll.id, uid);
  const ideas = useIdeas(poll.id);
  const all = usePicks(poll.id);
  const [idea, setIdea] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justDeclined, setJustDeclined] = useState(false);
  if (mine === null || !ideas || !all) return null;
  const my = all[uid];
  const declined = !!mine && mine.no && !my;
  if (declined) return justDeclined ? <Declined q={poll.q} onUndo={() => undecline(poll.id).then(() => setJustDeclined(false))} /> : null;
  const run = async (f: () => Promise<unknown>) => {
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
  const list = entries(poll, ideas, all);
  const shown = more ? list : list.slice(0, FIRST);
  const myIdeas = ideas.filter((x) => x.by === uid);
  const voters = pickers(all, poll, ideas).length;
  const toggle = (e: Entry) => {
    const on = picks(my, e);
    let c = my?.c ?? [];
    const d = {...(my?.d ?? {})};
    if (e.idea) {
      if (on) delete d[e.idea.iid];
      else d[e.idea.iid] = e.idea.n;
    } else c = on ? c.filter((x) => x !== e.i) : [...c, e.i!].sort((a, b) => a - b);
    void run(() => savePicks(poll, c, d, ideas, !!mine && mine.no));
  };
  const add = async (ev: FormEvent) => {
    ev.preventDefault();
    if (await run(() => addIdea(poll, idea, ideas))) setIdea('');
  };
  const written = note ?? (mine ? mine.t : '');
  const answered = !!my || !!(mine && mine.t);
  return (
    <section className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-violet-300">
        <Lightbulb size={14} /> Санал асуулга · {dayLabel(poll.at)}
        <span className="font-normal text-violet-300/80">· санаа нэмж, дуртайдаа санал өгнө</span>
      </p>
      <p className="mt-1 whitespace-pre-wrap font-medium text-neutral-100 [overflow-wrap:anywhere]">{poll.q}</p>
      <ul className="mt-3 flex flex-col gap-1.5" aria-label={poll.q}>
        {shown.map((e, rank) => {
          const own = e.idea?.by === uid;
          return (
            <li key={e.key} className="flex items-center gap-1.5">
              <Choice text={e.text} on={picks(my, e)} multi onClick={() => toggle(e)} disabled={busy}>
                {own && <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[11px] text-violet-200">Таны санаа</span>}
                {rank < TOP && e.count > 0 && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-[11px] font-bold text-amber-300" title={`${rank + 1}-р байр`}>
                    {rank + 1}
                  </span>
                )}
                <span className="w-7 shrink-0 text-right tabular-nums text-neutral-300">{e.count}</span>
              </Choice>
              {own && (
                <button type="button" disabled={busy} onClick={() => confirm('Энэ санаагаа устгах уу? Түүнд өгсөн саналууд тоологдохоо болино.') && run(() => deleteIdea(poll.id, e.idea!.iid))} aria-label="Санаагаа устгах" className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
                  <X size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {list.length > FIRST && (
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="mt-1.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
          <ChevronDown size={14} className={`transition-transform ${more ? 'rotate-180' : ''}`} /> {more ? 'Цөөнийг харуулах' : `Бүгдийг харах (${list.length})`}
        </button>
      )}
      {myIdeas.length < IDEAS_EACH ? (
        <form onSubmit={add} className="mt-2 flex items-center gap-2">
          <input value={idea} maxLength={80} onChange={(e) => setIdea(e.target.value)} placeholder="Шинэ санаа нэмэх" aria-label="Шинэ санаа" className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          <button disabled={busy || !idea.trim()} className="flex shrink-0 items-center gap-1 rounded-full bg-violet-500 px-3.5 py-2 text-sm font-semibold text-black hover:bg-violet-400 disabled:opacity-50">
            <Plus size={15} /> Нэмэх
          </button>
        </form>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">Та {IDEAS_EACH} санаа нэмсэн. Шинийг нэмэхийн тулд нэгийг нь устгана уу.</p>
      )}
      {poll.comment && (
        <div className="mt-2 space-y-1.5">
          <textarea value={written} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} placeholder="Багшид бичих (зөвхөн багш харна, заавал биш)" aria-label="Багшид бичих" className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          {note !== null && note.trim() !== (mine ? mine.t : '') && note.trim() && (
            <button type="button" disabled={busy} onClick={() => void run(() => vote(poll.id, [], note)).then((ok) => ok && setNote(null))} className="rounded-full bg-violet-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-violet-400 disabled:opacity-50">
              {mine && mine.t ? 'Шинэчлэх' : 'Багшид илгээх'}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 flex-1 text-xs text-neutral-500">
          {voters ? `${voters} хүн санал өгсөн. ` : ''}Саналын тоог бүгд харна; хэн санаа нэмж, хэн юу сонгосныг зөвхөн багш харна.
        </span>
        {!answered && <DeclineButton busy={busy} onClick={() => void run(() => decline(poll.id)).then((ok) => ok && setJustDeclined(true))} />}
      </div>
    </section>
  );
}
