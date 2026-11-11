import {ChevronDown, Lock, LockOpen, Trash2, Users, X} from 'lucide-react';
import {useState} from 'react';
import Switch from '../../components/Switch';
import {setLead} from '../../lib/accounts';
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
      <h3 className="flex items-center gap-2 pt-2 font-semibold">
        <Users size={18} className="text-sky-300" /> Сурагчдын гаргасан асуулга{shown.length ? ` (${shown.length})` : ''}
      </h3>
      <div className="overflow-hidden rounded-2xl bg-neutral-900">
        <Switch on={on} busy={busy || !settings} onChange={flip} className="items-start p-4">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Сурагчид ангидаа санал асуулга гаргаж болно</span>
            <span className="mt-1 block text-sm text-neutral-400">
              Доор сонгосон «Багшийн хариуцагч» сурагч бүр зэрэг 3 хүртэл асуулга гаргана, бусад нь хариулна. Ангийнхан нь сонголтоо хийгээд нийт дүнг харна, хэн гаргаж хэн юу сонгосныг харахгүй. Та бүгдийг харж, хааж, устгаж болно. Унтраавал асуулгууд
              сурагчдад харагдахгүй болж, шинээр гаргах, сонголт хийх боломжгүй болно (устахгүй).
            </span>
          </span>
        </Switch>
        <Leads data={data} picked={picked} />
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
    </div>
  );
}

function Row({poll, votes, data}: {poll: ClassPoll; votes: ClassVotes | undefined; data: AdminData}) {
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
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-[12rem] flex-1">
          <p className="whitespace-pre-wrap font-medium break-words">{poll.q}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            <span className="text-sky-300">{name(poll.by)}</span> гаргасан · {cls} · {dayLabel(poll.at)} {clock(poll.at)}
            {poll.multi && ' · олон сонголт'}
            {poll.closed > 0 && ' · хаагдсан'}
          </p>
        </div>
        <span className="ml-auto w-20 shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums">
            {voters}/{asked.length}
          </span>
          <span className="block text-[11px] text-neutral-500">хариулсан</span>
        </span>
      </div>
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
    </li>
  );
}

/** «Багшийн хариуцагч»: the students (of the picked class) who may ask their class a poll; added and taken off here. */
function Leads({data, picked}: {data: AdminData; picked: string}) {
  const classes = useClasses() ?? [];
  const [busy, setBusy] = useState('');
  const cls = (id?: string) => classes.find((c) => c.id === id)?.name ?? '';
  const students = data.students
    .filter((s) => !s.profile.disabled && s.profile.class && (!picked || s.profile.class === picked))
    .sort((a, b) => cls(a.profile.class).localeCompare(cls(b.profile.class), 'mn', {numeric: true}) || a.profile.name.localeCompare(b.profile.name, 'mn'));
  const leads = students.filter((s) => s.profile.lead === true);
  const others = students.filter((s) => s.profile.lead !== true);
  const change = async (uid: string, on: boolean) => {
    setBusy(uid);
    try {
      await setLead(uid, on);
    } catch (e) {
      alert(`Хадгалж чадсангүй: ${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="space-y-2 border-t border-neutral-800 p-4">
      <p className="text-sm font-semibold">Багшийн хариуцагч ({leads.length})</p>
      <p className="text-xs text-neutral-400">Зөвхөн эдгээр сурагч ангидаа асуулга гаргана. Бусад нь асуулгад хариулна.</p>
      <div className="flex flex-wrap gap-1.5">
        {leads.map((s) => (
          <span key={s.uid} className="flex items-center gap-1 rounded-full bg-sky-500/15 py-1 pl-3 pr-1 text-sm text-sky-100">
            {s.profile.name}
            {!picked && <span className="text-xs text-sky-300/80">· {cls(s.profile.class)}</span>}
            <button type="button" disabled={busy === s.uid} onClick={() => change(s.uid, false)} aria-label={`${s.profile.name}-ийг хариуцагчаас хасах`} className="rounded-full p-1 text-sky-300 hover:bg-sky-500/20 hover:text-white disabled:opacity-50">
              <X size={13} />
            </button>
          </span>
        ))}
        {!leads.length && <span className="text-sm text-neutral-500">Одоохондоо алга — асуулга гаргах хүн алга.</span>}
      </div>
      {others.length > 0 && (
        <select
          value=""
          disabled={!!busy}
          onChange={(e) => e.target.value && change(e.target.value, true)}
          aria-label="Хариуцагч нэмэх"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-sky-400 sm:w-auto"
        >
          <option value="">+ Хариуцагч нэмэх…</option>
          {others.map((s) => (
            <option key={s.uid} value={s.uid}>
              {s.profile.name}
              {picked ? '' : ` · ${cls(s.profile.class)}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

