import {Check, ChevronDown, Vote as VoteIcon} from 'lucide-react';
import {useState} from 'react';
import {forClass} from '../lib/live';
import {useMyVote, usePolls, vote, type Poll} from '../lib/polls';
import {dayLabel} from '../lib/time';

/** The teacher's open polls for the student's class, on their home page: answered, one line (and «Өөрчлөх»). */
export default function Polls({uid, classId}: {uid: string; classId?: string}) {
  const polls = usePolls();
  const mine = (polls ?? []).filter((p) => !p.closed && forClass(p.classes, classId));
  if (!mine.length) return null;
  return (
    <>
      {mine.map((p) => (
        <PollCard key={p.id} poll={p} uid={uid} />
      ))}
    </>
  );
}

function PollCard({poll, uid}: {poll: Poll; uid: string}) {
  const mine = useMyVote(poll.id, uid);
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<number[] | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Until changed here: what they answered before.
  const had = mine || null;
  const chosen = picked ?? had?.c ?? [];
  const written = text ?? had?.t ?? '';
  const done = !!had && !editing;
  const ready = chosen.length > 0 || (!poll.options.length && written.trim().length > 0);
  const toggle = (i: number) => setPicked(poll.multi ? (chosen.includes(i) ? chosen.filter((x) => x !== i) : [...chosen, i].sort((a, b) => a - b)) : [i]);
  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await vote(poll.id, chosen, poll.comment ? written : '');
      setEditing(false);
      setPicked(null);
      setText(null);
    } catch (e) {
      setError(/permission/i.test((e as Error).message) ? 'Илгээж чадсангүй: асуулга хаагдсан байж магадгүй.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (mine === null) return null;
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
              {poll.options.map((o, i) => {
                const on = chosen.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    role={poll.multi ? 'checkbox' : 'radio'}
                    aria-checked={on}
                    onClick={() => toggle(i)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${on ? 'border-violet-400 bg-violet-500/20 text-neutral-50' : 'border-neutral-700 bg-neutral-900/60 text-neutral-200 hover:border-neutral-500'}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${poll.multi ? 'rounded-md' : 'rounded-full'} ${on ? 'border-violet-400 bg-violet-400 text-black' : 'border-neutral-500'}`}>
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{o}</span>
                  </button>
                );
              })}
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
            {had && (
              <button type="button" onClick={() => (setEditing(false), setPicked(null), setText(null))} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800">
                Болих
              </button>
            )}
            <span className="text-xs text-neutral-500">Таны хариуг зөвхөн багш харна.</span>
          </div>
        </div>
      )}
    </section>
  );
}
