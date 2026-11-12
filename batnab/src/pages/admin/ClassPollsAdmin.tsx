import {ChevronDown, Lock, LockOpen, Trash2, Users} from 'lucide-react';
import {useState} from 'react';
import Switch from '../../components/Switch';
import {useFolded} from '../../lib/fold';
import PollHead from './PollHead';
import {closeClassPoll, declinedOf, deleteClassPoll, reopenClassPoll, tally, useAllClassPolls, useAllClassVotes, votesOf, type ClassPoll, type ClassVotes} from '../../lib/classPolls';
import {useClasses} from '../../lib/classes';
import {saveSetting, useSettings} from '../../lib/settings';
import {clock, dayLabel} from '../../lib/time';
import type {AdminData} from './data';

/**
 * The students' own polls («Ангийн санал асуулга»), in the teacher's poll section: the switch that allows them, and
 * every poll (of the picked class) with who asked it and who picked what — closed or deleted here as the teacher likes.
 */
export default function ClassPollsAdmin({data, picked}: {data: AdminData; picked: string}) {
  const settings = useSettings();
  const polls = useAllClassPolls();
  const votes = useAllClassVotes();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const on = settings?.studentPolls !== false;
  const [folded, fold] = useFolded('admin.classPolls');
  const shown = (polls ?? []).filter((p) => !picked || p.cls === picked);
  const flip = async (next: boolean) => {
    setBusy(true);
    setError('');
    try {
      await saveSetting('studentPolls', next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <h3 className="pt-2 font-semibold">
        <button type="button" onClick={fold} aria-expanded={!folded} className="flex w-full items-center gap-2 rounded-lg text-left hover:opacity-80">
          <Users size={18} className="shrink-0 text-sky-300" /> Сурагчдын гаргасан асуулга{shown.length ? ` (${shown.length})` : ''}
          <ChevronDown size={18} aria-hidden className={`ml-auto shrink-0 text-neutral-500 transition-transform ${folded ? '' : 'rotate-180'}`} />
        </button>
      </h3>
      {!folded && (
        <>
      <div className="overflow-hidden rounded-2xl bg-neutral-900">
        <Switch on={on} busy={busy || !settings} onChange={flip} className="items-start p-4">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Сурагчид ангидаа санал асуулга гаргаж болно</span>
            <span className="mt-1 block text-sm text-neutral-400">
              «Ангийн дарга» хэсэгт сонгосон ангийн дарга бүр зэрэг 3 хүртэл асуулга гаргана, бусад нь хариулна. Ангийнхан нь сонголтоо хийгээд нийт дүнг харна, хэн гаргаж хэн юу сонгосныг харахгүй. Та бүгдийг харж, хааж, устгаж болно. Унтраавал асуулгууд
              сурагчдад харагдахгүй болж, шинээр гаргах, сонголт хийх боломжгүй болно (устахгүй).
            </span>
          </span>
        </Switch>
      </div>
      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">Хадгалж чадсангүй: {error}</p>}
      {polls && votes && !shown.length && <p className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-neutral-400">Одоохондоо сурагчдын гаргасан асуулга алга.</p>}
      {shown.length > 0 && (
        <ul className="space-y-3">
          {shown.map((p) => (
            <Row key={`${p.cls}/${p.by}/${p.slot}/${p.id}`} poll={p} votes={votes?.[p.cls]} data={data} />
          ))}
        </ul>
      )}
        </>
      )}
    </div>
  );
}

function Row({poll, votes, data}: {poll: ClassPoll; votes: ClassVotes | undefined; data: AdminData}) {
  const [folded, fold] = useFolded(`admin.cpoll:${poll.id}`);
  const classes = useClasses() ?? [];
  const [who, setWho] = useState(false);
  const byUid = new Map(data.students.map((s) => [s.uid, s]));
  const name = (uid: string) => byUid.get(uid)?.profile.name ?? 'устгагдсан сурагч';
  const picks = votesOf(poll, votes);
  const {voters, counts} = tally(poll, votes);
  const asked = data.students.filter((s) => !s.profile.disabled && s.profile.class === poll.cls);
  const no = new Set(declinedOf(poll, votes));
  const quiet = asked.filter((s) => !picks[s.uid] && !no.has(s.uid));
  const top = Math.max(0, ...counts);
  const cls = classes.find((c) => c.id === poll.cls)?.name ?? 'устгасан анги';
  const run = (f: () => Promise<unknown>) => f().catch((e) => alert((e as Error).message));
  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 ${poll.closed ? 'opacity-80' : ''}`}>
      <PollHead
        folded={folded}
        onFold={fold}
        q={poll.q}
        meta={
          <>
            <span className="text-sky-300">{name(poll.by)}</span> гаргасан · {cls} · {dayLabel(poll.at)} {clock(poll.at)}
            {poll.multi && ' · олон сонголт'}
            {poll.closed > 0 && ' · хаагдсан'}
          </>
        }
        answered={voters}
        total={asked.length}
      />
      {!folded && (
        <>
      <ul className="mt-3 space-y-2">
        {poll.options.map((o, i) => {
          const pct = voters ? Math.round((counts[i] / voters) * 100) : 0;
          return (
            <li key={i} className="text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={`min-w-[8rem] flex-1 break-words ${counts[i] === top && top > 0 ? 'font-semibold' : ''}`}>{o}</span>
                <span className="ml-auto shrink-0 tabular-nums text-neutral-400">
                  {counts[i]} · {pct}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full rounded-full bg-sky-400" style={{width: `${pct}%`}} />
              </div>
            </li>
          );
        })}
      </ul>
      {who && (
        <div className="mt-3 space-y-2 text-sm">
          {poll.options.map((o, i) => (
            <p key={i}>
              <span className="text-neutral-400">{o}:</span>{' '}
              {Object.keys(picks)
                .filter((uid) => picks[uid].includes(i))
                .map(name)
                .join(', ') || '—'}
            </p>
          ))}
          <p>
            <span className="text-neutral-400">Хариулахгүй гэсэн ({no.size}):</span> {[...no].map(name).join(', ') || '—'}
          </p>
          <p>
            <span className="text-neutral-400">Хариулаагүй ({quiet.length}):</span> {quiet.map((s) => s.profile.name).join(', ') || '—'}
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setWho(!who)} aria-expanded={who} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
          <ChevronDown size={14} className={`transition-transform ${who ? 'rotate-180' : ''}`} /> Хэн юу сонгосон
        </button>
        <button type="button" onClick={() => run(() => (poll.closed ? reopenClassPoll(poll) : closeClassPoll(poll)))} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
          {poll.closed ? <LockOpen size={14} /> : <Lock size={14} />} {poll.closed ? 'Дахин нээх' : 'Хаах'}
        </button>
        <button
          type="button"
          onClick={() => confirm(`${name(poll.by)}-ийн гаргасан асуулгыг хариултуудтай нь устгах уу?`) && run(() => deleteClassPoll(poll))}
          className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
        >
          <Trash2 size={14} /> Устгах
        </button>
      </div>
        </>
      )}
    </li>
  );
}
