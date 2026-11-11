import {CheckCircle2, ChevronDown, ClipboardList, Lock, LockOpen, Megaphone, Plus, School, Send, Timer, Trash2, TriangleAlert, Vote as VoteIcon, X} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {assignmentState, assignmentTitle, dueLeft} from '../../components/Today';
import {createAssignment, deleteAnnouncement, deleteAssignment, openTopicTo, postAnnouncement, topicGap, useAnnouncements, useAssignments} from '../../lib/classroom';
import {useClasses} from '../../lib/classes';
import {forClass} from '../../lib/live';
import {clock, dayLabel, useNow} from '../../lib/time';
import {attemptTime, timeText, topicTimeKey, useAllTimeOn, type TimeOn} from '../../lib/timeOn';
import {closePoll, createPoll, deleteIdea, deletePoll, entries, MAX_OPTIONS, pickers, picks, TOP, useIdeas, usePicks, usePolls, useVotes, type Poll, type Vote} from '../../lib/polls';
import {problemNo, useAllProgress, useTopics, type Topic} from '../../lib/topics';
import type {Assignment} from '../../lib/classroom';
import type {Result} from '../../lib/results';
import {TESTS} from '../../tests';
import ClassPollsAdmin from './ClassPollsAdmin';
import PollHead from './PollHead';
import {useFolded} from '../../lib/fold';
import type {AdminData} from './data';

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';
const primary = 'flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50';

/** "datetime-local" value for a time: three days from now, 20:00. */
const local = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const inThreeDays = () => {
  const d = new Date(Date.now() + 3 * 86_400_000);
  d.setHours(20, 0, 0, 0);
  return local(d.getTime());
};

/** Which classes something goes to: the picked class (or every class) to start with. */
function Targets({value, onChange}: {value: string[]; onChange: (v: string[]) => void}) {
  const classes = useClasses() ?? [];
  if (!classes.length) return null;
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm ${on ? 'bg-blue-500 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-neutral-400">
        <School size={15} /> Анги:
      </span>
      <button type="button" onClick={() => onChange([])} className={chip(!value.length)}>
        Бүх анги
      </button>
      {classes.map((c) => (
        <button key={c.id} type="button" onClick={() => onChange(value.includes(c.id) ? value.filter((x) => x !== c.id) : [...value, c.id])} className={chip(value.includes(c.id))}>
          {c.name}
        </button>
      ))}
    </div>
  );
}

const asMap = (ids: string[]) => (ids.length ? Object.fromEntries(ids.map((id) => [id, true as const])) : undefined);

/** Assignments with a deadline, and announcements on the students' home page. */
export default function TasksTab({data, picked}: {data: AdminData; picked: string}) {
  return (
    <div className="space-y-8">
      <Assignments data={data} picked={picked} />
      <Announcements picked={picked} />
      <Polls data={data} picked={picked} />
    </div>
  );
}

/**
 * How long a student took over an assignment (seen only by the teacher; lib/timeOn): a topic's whole time on its page and
 * each problem's until answered; a test's handed-in attempt (or the one going on), and each question's. Away from it
 * over 30 minutes doesn't count. Null: none yet.
 */
function timeFor(a: Assignment, topics: Topic[] | null, mine: Record<string, TimeOn> | undefined, results: Result[]) {
  if (a.kind === 'topic') {
    const t = mine?.[topicTimeKey(a.ref)];
    if (!t || !t.all) return null;
    const ps = topics?.find((x) => x.id === a.ref)?.problems ?? [];
    return {all: t.all, q: ps.flatMap((p, i) => (t.q[p.id] ? [{label: `${problemNo(p, i)}`, s: t.q[p.id]}] : []))};
  }
  const r = results.filter((x) => x.test === a.ref && x.at >= a.createdAt).sort((x, y) => x.at - y.at)[0];
  const t = r
    ? attemptTime(mine, a.ref, r.id, r.at - r.seconds * 1000)
    : Object.entries(mine ?? {})
        .filter(([k]) => k.startsWith(`t${a.ref}_`) && Number(k.slice(k.indexOf('_') + 1)) >= a.createdAt - 60_000)
        .sort(([x], [y]) => y.localeCompare(x))[0]?.[1];
  if (!r && !t?.all) return null;
  const q = Object.entries(t?.q ?? {})
    .map(([qi, s]) => ({label: `${Number(qi) + 1}`, s}))
    .sort((x, y) => Number(x.label) - Number(y.label));
  // The time counted on the attempt (away over 30 minutes left out); an attempt from before that was counted: start to end.
  return {all: t?.all ? t.all : r!.seconds, q};
}

function Assignments({data, picked}: {data: AdminData; picked: string}) {
  const now = useNow(60_000);
  const assignments = useAssignments();
  const topics = useTopics();
  const progress = useAllProgress();
  const classes = useClasses() ?? [];
  const [kind, setKind] = useState<'topic' | 'test'>('topic');
  const [target, setTarget] = useState('');
  const [due, setDue] = useState(inThreeDays);
  const [to, setTo] = useState<string[]>(picked ? [picked] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Said after an assignment opened its topic to more classes.
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  // A student's times opened under an assignment (assignment id/uid).
  const [timeOpen, setTimeOpen] = useState<string | null>(null);
  const times = useAllTimeOn(open !== null);
  const published = (topics ?? []).filter((t) => t.published);
  const options = kind === 'topic' ? published.map((t) => [t.id, t.title] as const) : TESTS.map((t) => [t.id, t.title] as const);
  const chosen = options.some(([id]) => id === target) ? target : (options[0]?.[0] ?? '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const at = new Date(due).getTime();
    if (!chosen || !at) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      // A topic open to other classes only: opened to the ones it is given to as well, or they wouldn't see it.
      const t = kind === 'topic' ? topics?.find((x) => x.id === chosen) : undefined;
      const gap = t ? topicGap(asMap(to), t, classes) : null;
      await createAssignment({kind, ref: chosen, due: at, classes: asMap(to)}, gap ? gap.open : undefined);
      if (gap && t) setNote(`«${t.title}» сэдвийг ${gap.open ? `${gap.names.join(', ')} ангид` : 'бүх ангид'} ч нээлээ (өмнө нь зөвхөн ${Object.keys(t.classes ?? {}).map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean).join(', ') || 'цөөн'} ангид нээлттэй байсан).`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const shown = (assignments ?? []).filter((a) => !picked || forClass(a.classes, picked)).sort((a, b) => Number(a.due < now) - Number(b.due < now) || a.due - b.due);

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <ClipboardList size={18} className="text-blue-300" /> Даалгавар
      </h2>
      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <div className="flex rounded-full bg-neutral-800 p-1 text-sm" role="radiogroup" aria-label="Юу даалгах вэ">
          {(
            [
              ['topic', 'Сэдэв'],
              ['test', 'Тест'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`flex-1 rounded-full px-3 py-1.5 font-medium ${kind === k ? 'bg-neutral-600 text-neutral-50' : 'text-neutral-400'}`}>
              {label}
            </button>
          ))}
        </div>
        {kind === 'topic' && !published.length ? (
          <p className="text-sm text-neutral-400">Нээлттэй сэдэв алга. Эхлээд «Сэдэв» хэсэгт сэдвээ сурагчдад нээгээрэй.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-neutral-300">{kind === 'topic' ? 'Сэдэв' : 'Тест'}</span>
              <select value={chosen} onChange={(e) => setTarget(e.target.value)} className={`${field} mt-1`}>
                {options.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-neutral-300">Хугацаа (хүртэл)</span>
              <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={`${field} mt-1 [color-scheme:dark]`} />
            </label>
          </div>
        )}
        <Targets value={to} onChange={setTo} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {note && <p className="text-sm text-green-300">{note}</p>}
        <button disabled={busy || !chosen || !due} className={primary}>
          <ClipboardList size={16} /> {busy ? 'Өгч байна…' : 'Даалгавар өгөх'}
        </button>
      </form>

      {!shown.length ? (
        <p className="text-sm text-neutral-400">Одоогоор даалгавар алга.</p>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
          {shown.map((a) => {
            const who = data.students.filter((s) => !s.profile.disabled && forClass(a.classes, s.profile.class));
            const rows = who.map((s) => ({s, st: assignmentState(a, topics, progress?.[s.uid], data.results.filter((r) => r.uid === s.uid))}));
            const done = rows.filter((r) => r.st.done);
            const over = a.due < now;
            const names = Object.keys(a.classes ?? {}).map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean);
            return (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setOpen(open === a.id ? null : a.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-medium">
                      {a.kind === 'test' ? 'Тест: ' : 'Сэдэв: '}
                      {assignmentTitle(a, topics)}
                    </span>
                    <span className={`block text-xs ${over ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      {dayLabel(a.due)} {clock(a.due)} хүртэл · {over ? 'дууссан' : dueLeft(a.due, now)} · {names.length ? names.join(', ') : 'Бүх анги'}
                    </span>
                  </button>
                  <span className="w-16 shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {done.length}/{rows.length}
                    </span>
                    <span className="block text-[11px] text-neutral-500">хийсэн</span>
                  </span>
                  <button onClick={() => confirm('Энэ даалгаврыг устгах уу?') && deleteAssignment(a.id).catch((e) => alert(e.message))} aria-label="Устгах" className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
                    <Trash2 size={15} />
                  </button>
                </div>
                {(() => {
                  // Its topic shut to some of the classes it is given to (or a draft): those students don't see it.
                  const t = a.kind === 'topic' ? topics?.find((x) => x.id === a.ref) : undefined;
                  if (!t) return null;
                  if (!t.published)
                    return (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300">
                        <TriangleAlert size={13} className="shrink-0" /> Сэдэв нь ноорог (сурагчдад нээгээгүй): сурагчид харахгүй.
                      </p>
                    );
                  const gap = topicGap(a.classes, t, classes);
                  if (!gap) return null;
                  return (
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-300">
                      <TriangleAlert size={13} className="shrink-0" /> Сэдэв нь {gap.names.join(', ')} ангид хаалттай: тэд энэ даалгаврыг харахгүй.
                      <button type="button" onClick={() => openTopicTo(t.id, gap.open).catch((e) => alert(e.message))} className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-medium text-amber-200 hover:bg-amber-500/25">
                        Сэдвийг {gap.open ? `${gap.names.join(', ')} ангид` : 'бүх ангид'} нээх
                      </button>
                    </p>
                  );
                })()}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full rounded-full bg-[#3987e5]" style={{width: `${rows.length ? (done.length / rows.length) * 100 : 0}%`}} />
                </div>
                {open === a.id && (
                  <div className="mt-3">
                    <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <Timer size={13} /> Зарцуулсан хугацаа: нэр дээр дарж бодлого бүрийнхийг харна. Зөвхөн танд харагдана.
                    </p>
                    <ul className="mt-2 divide-y divide-neutral-800/70 text-sm">
                      {rows
                        .sort((x, y) => Number(x.st.done) - Number(y.st.done) || x.s.profile.name.localeCompare(y.s.profile.name, 'mn'))
                        .map(({s, st}) => {
                          const time = times ? timeFor(a, topics, times[s.uid], data.results.filter((r) => r.uid === s.uid)) : undefined;
                          const k = `${a.id}/${s.uid}`;
                          const long = time ? [...time.q].sort((x, y) => y.s - x.s).slice(0, 3).filter((x) => x.s >= 60).map((x) => x.label) : [];
                          return (
                            <li key={s.uid} className="py-1.5">
                              <button type="button" onClick={() => setTimeOpen(timeOpen === k ? null : k)} disabled={!time} aria-expanded={timeOpen === k} className="flex w-full items-center gap-2 text-left">
                                {st.done ? <CheckCircle2 size={14} className="shrink-0 text-green-400" /> : <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${over ? 'border-red-400' : 'border-neutral-600'}`} />}
                                <span className={`min-w-0 truncate ${st.done ? 'text-neutral-400' : ''}`}>{s.profile.name}</span>
                                {st.late && <span className="shrink-0 text-xs text-amber-300">хоцорсон</span>}
                                {!st.done && a.kind === 'topic' && st.total > 0 && st.count > 0 && (
                                  <span className="shrink-0 text-xs text-neutral-500">
                                    {st.count}/{st.total}
                                  </span>
                                )}
                                <span className="ml-auto flex shrink-0 items-center gap-1 text-xs tabular-nums text-neutral-400">
                                  {time === undefined ? '…' : time ? (
                                    <>
                                      <Timer size={12} /> {timeText(time.all)}
                                      <ChevronDown size={13} className={`transition-transform ${timeOpen === k ? 'rotate-180' : ''}`} />
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              </button>
                              {timeOpen === k && time && (
                                <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                                  {time.q.length ? (
                                    time.q.map((x) => (
                                      <span key={x.label} className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${long.includes(x.label) ? 'bg-amber-500/15 text-amber-200' : 'bg-neutral-800 text-neutral-300'}`}>
                                        {x.label}-р: {timeText(x.s)}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-neutral-500">Бодлого тус бүрийн хугацаа алга.</span>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Announcements({picked}: {picked: string}) {
  const list = useAnnouncements();
  const classes = useClasses() ?? [];
  const [text, setText] = useState('');
  const [to, setTo] = useState<string[]>(picked ? [picked] : []);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await postAnnouncement(text, asMap(to));
      setText('');
    } catch (err) {
      alert(`Алдаа: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const shown = (list ?? []).filter((a) => !picked || forClass(a.classes, picked));
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Megaphone size={18} className="text-amber-300" /> Зарлал
      </h2>
      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <textarea value={text} maxLength={600} rows={3} onChange={(e) => setText(e.target.value)} placeholder="Жишээ: Маргааш 2-р цагт шалгалттай. Логарифмаа давтаарай!" className={`${field} resize-y`} aria-label="Зарлал" />
        <Targets value={to} onChange={setTo} />
        <button disabled={busy || !text.trim()} className={primary}>
          <Send size={16} /> {busy ? 'Илгээж байна…' : 'Зарлах'}
        </button>
        <p className="text-xs text-neutral-500">Сурагчдын нүүр хуудсанд 3 долоо хоног харагдана (сурагч хааж болно).</p>
      </form>
      {shown.length > 0 && (
        <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
          {shown.map((a) => {
            const names = Object.keys(a.classes ?? {}).map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean);
            return (
              <li key={a.id} className="flex gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm">{a.text}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {dayLabel(a.at)} {clock(a.at)} · {names.length ? names.join(', ') : 'Бүх анги'}
                  </p>
                </div>
                <button onClick={() => confirm('Энэ зарлалыг устгах уу?') && deleteAnnouncement(a.id).catch((e) => alert(e.message))} aria-label="Устгах" className="h-fit rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Polls («Санал асуулга»): a question to the students, with options (one or several picked) and/or a written answer;
 * their answers, as counts and who said what, here only. Closed: no more answers; deleted with the answers. */
function Polls({data, picked}: {data: AdminData; picked: string}) {
  const polls = usePolls();
  const [q, setQ] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [comment, setComment] = useState(false);
  const [ideas, setIdeas] = useState(false);
  const [to, setTo] = useState<string[]>(picked ? [picked] : []);
  const [busy, setBusy] = useState(false);
  const filled = options.filter((o) => o.trim());
  // Options, or a written answer (or both).
  const ready = q.trim() && (ideas || filled.length >= 2 || (filled.length <= 1 && comment));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createPoll({q, options: filled, multi, comment, ideas, classes: asMap(to)});
      setQ('');
      setOptions(['', '']);
      setMulti(false);
      setComment(false);
      setIdeas(false);
    } catch (err) {
      alert(`Алдаа: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const shown = (polls ?? []).filter((p) => !picked || forClass(p.classes, picked));
  const check = 'h-4 w-4 accent-violet-500';
  const [allFolded, foldAll] = useFolded('admin.polls');
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">
        <button type="button" onClick={foldAll} aria-expanded={!allFolded} className="flex w-full items-center gap-2 rounded-lg text-left hover:opacity-80">
          <VoteIcon size={18} className="shrink-0 text-violet-300" /> Санал асуулга{shown.length ? ` (${shown.length})` : ''}
          <ChevronDown size={18} aria-hidden className={`ml-auto shrink-0 text-neutral-500 transition-transform ${allFolded ? '' : 'rotate-180'}`} />
        </button>
      </h2>
      {!allFolded && (
        <>
      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <textarea value={q} maxLength={300} rows={2} onChange={(e) => setQ(e.target.value)} placeholder="Асуулт, жишээ нь: Шинэ «Алдааны дэвтэр» танд хэр хэрэгтэй байна вэ?" className={`${field} resize-y`} aria-label="Асуулт" />
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-sm text-neutral-500">{i + 1}.</span>
              <input value={o} maxLength={120} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? 'Жишээ: Маш хэрэгтэй' : i === 1 ? 'Жишээ: Заримдаа' : 'Сонголт'} className={`${field} py-2`} aria-label={`${i + 1}-р сонголт`} />
              <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Сонголт хасах" className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
                <X size={15} />
              </button>
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button type="button" onClick={() => setOptions([...options, ''])} className="ml-7 flex items-center gap-1 rounded-full px-2.5 py-1 text-sm text-violet-300 hover:bg-violet-500/10">
              <Plus size={14} /> Сонголт нэмэх
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={ideas} onChange={(e) => setIdeas(e.target.checked)} className={check} /> Сурагчид санаа нэмж, бүгд санал өгнө
          </label>
          {!ideas && (
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className={check} /> Хэд хэдийг сонгож болно
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={comment} onChange={(e) => setComment(e.target.checked)} className={check} /> Сурагч санаагаа бичиж болно
          </label>
        </div>
        <Targets value={to} onChange={setTo} />
        <button disabled={busy || !ready} className="flex items-center gap-2 rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-black hover:bg-violet-400 disabled:opacity-50">
          <VoteIcon size={16} /> {busy ? 'Илгээж байна…' : 'Асуулга илгээх'}
        </button>
        <p className="text-xs text-neutral-500">
          Сурагчдын нүүр хуудсанд гарна (хаах хүртэл). Хоёроос доошгүй сонголт, эсвэл «санаагаа бичиж болно». Хариуг зөвхөн та харна.
          {ideas && ' «Санаа нэмэх»: сурагч бүр 3 хүртэл санаа нэмж, бүх сонголт, санаанаас дуртайдаа санал өгнө; саналын тоо бүгдэд харагдана, хэн нэмж, хэн юу сонгосныг зөвхөн та харна. Сонголтгүй ч болно.'}
        </p>
      </form>
      {shown.length > 0 && (
        <ul className="space-y-3">
          {shown.map((p) => (p.ideas ? <IdeasResult key={p.id} poll={p} data={data} /> : <PollResult key={p.id} poll={p} data={data} />))}
        </ul>
      )}
      <ClassPollsAdmin data={data} picked={picked} />
        </>
      )}
    </section>
  );
}

function PollResult({poll, data}: {poll: Poll; data: AdminData}) {
  const [folded, fold] = useFolded(`admin.poll:${poll.id}`);
  const votes = useVotes(poll.id);
  const classes = useClasses() ?? [];
  const [who, setWho] = useState(false);
  const asked = data.students.filter((s) => !s.profile.disabled && forClass(poll.classes, s.profile.class));
  const answered = asked.filter((s) => votes?.[s.uid] && !votes[s.uid].no);
  const declined = asked.filter((s) => votes?.[s.uid]?.no);
  const quiet = asked.filter((s) => !votes?.[s.uid]);
  // One pick each where only one may be picked (the rules hold it; an older answer could have more).
  const picks = (uid: string) => (poll.multi ? votes![uid].c : votes![uid].c.slice(0, 1));
  const counts = poll.options.map((_, i) => answered.filter((s) => picks(s.uid).includes(i)).length);
  const top = Math.max(0, ...counts);
  const comments = answered.filter((s) => votes![s.uid].t);
  const names = Object.keys(poll.classes ?? {}).map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean);
  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 ${poll.closed ? 'opacity-80' : ''}`}>
      <PollHead
        folded={folded}
        onFold={fold}
        q={poll.q}
        meta={
          <>
            {dayLabel(poll.at)} {clock(poll.at)} · {names.length ? names.join(', ') : 'Бүх анги'}
            {poll.multi && ' · олон сонголт'}
            {poll.closed && ' · хаагдсан'}
          </>
        }
        answered={votes ? answered.length : '…'}
        total={asked.length}
      />
      {!folded && (
        <>
      {poll.options.length > 0 && (
        <ul className="mt-3 space-y-2">
          {poll.options.map((o, i) => {
            const pct = answered.length ? Math.round((counts[i] / answered.length) * 100) : 0;
            return (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`min-w-[8rem] flex-1 break-words ${counts[i] === top && top > 0 ? 'font-semibold' : ''}`}>{o}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-neutral-400">
                    {counts[i]} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full rounded-full bg-violet-400" style={{width: `${pct}%`}} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {comments.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-neutral-400">Бичсэн санаа ({comments.length})</p>
          {comments.map((s) => (
            <p key={s.uid} className="rounded-xl bg-neutral-800/60 px-3 py-2 text-sm break-words">
              <span className="font-medium">{s.profile.name}:</span> <span className="whitespace-pre-wrap text-neutral-200">{votes![s.uid].t}</span>
            </p>
          ))}
        </div>
      )}
      {who && votes && (
        <div className="mt-3 space-y-2 text-sm">
          {poll.options.map((o, i) => (
            <p key={i}>
              <span className="text-neutral-400">{o}:</span>{' '}
              {answered
                .filter((s) => picks(s.uid).includes(i))
                .map((s) => s.profile.name)
                .join(', ') || '—'}
            </p>
          ))}
          <p>
            <span className="text-neutral-400">Хариулахгүй гэсэн ({declined.length}):</span> {declined.map((s) => s.profile.name).join(', ') || '—'}
          </p>
          <p>
            <span className="text-neutral-400">Хариулаагүй ({quiet.length}):</span> {quiet.map((s) => s.profile.name).join(', ') || '—'}
          </p>
        </div>
      )}
      {declined.length > 0 && !who && <p className="mt-2 text-xs text-neutral-500">{declined.length} сурагч «Хариулахгүй» гэсэн.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setWho(!who)} aria-expanded={who} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
          <ChevronDown size={14} className={`transition-transform ${who ? 'rotate-180' : ''}`} /> Хэн юу хариулсан
        </button>
        <button type="button" onClick={() => closePoll(poll.id, !poll.closed).catch((e) => alert(e.message))} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
          {poll.closed ? <LockOpen size={14} /> : <Lock size={14} />} {poll.closed ? 'Дахин нээх' : 'Хаах'}
        </button>
        <button
          type="button"
          onClick={() => confirm('Энэ асуулгыг хариултуудтай нь устгах уу?') && deletePoll(poll.id).catch((e) => alert(e.message))}
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

/** An ideas poll's results: every option and idea with its count (the top five numbered), who added each idea (to
 * delete one that doesn't belong), the written answers, and who picked what, said «Хариулахгүй» or hasn't answered. */
function IdeasResult({poll, data}: {poll: Poll; data: AdminData}) {
  const [folded, fold] = useFolded(`admin.poll:${poll.id}`);
  const votes = useVotes(poll.id);
  const ideas = useIdeas(poll.id);
  const all = usePicks(poll.id);
  const classes = useClasses() ?? [];
  const [who, setWho] = useState(false);
  const byUid = new Map(data.students.map((s) => [s.uid, s]));
  const name = (uid: string) => byUid.get(uid)?.profile.name ?? 'устгагдсан сурагч';
  const asked = data.students.filter((s) => !s.profile.disabled && forClass(poll.classes, s.profile.class));
  const list = ideas && all ? entries(poll, ideas, all) : [];
  const voters = ideas && all ? pickers(all, poll, ideas) : [];
  const said = (uid: string): Vote | undefined => votes?.[uid];
  const done = new Set([...voters, ...asked.filter((s) => said(s.uid)?.t).map((s) => s.uid)]);
  const answered = asked.filter((s) => done.has(s.uid));
  const declined = asked.filter((s) => !done.has(s.uid) && said(s.uid)?.no);
  const quiet = asked.filter((s) => !done.has(s.uid) && !said(s.uid));
  const comments = asked.filter((s) => said(s.uid)?.t);
  const names = Object.keys(poll.classes ?? {}).map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean);
  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 ${poll.closed ? 'opacity-80' : ''}`}>
      <PollHead
        folded={folded}
        onFold={fold}
        q={poll.q}
        meta={
          <>
            {dayLabel(poll.at)} {clock(poll.at)} · {names.length ? names.join(', ') : 'Бүх анги'} · сурагчид санаа нэмнэ ({ideas?.length ?? 0} санаа)
            {poll.closed && ' · хаагдсан'}
          </>
        }
        answered={all ? answered.length : '…'}
        total={asked.length}
      />
      {!folded && (
        <>
      <ul className="mt-3 space-y-2">
        {list.map((e, rank) => {
          const pct = voters.length ? Math.round((e.count / voters.length) * 100) : 0;
          return (
            <li key={e.key} className="text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={`w-5 shrink-0 text-right text-xs tabular-nums ${rank < TOP && e.count > 0 ? 'font-bold text-amber-300' : 'text-neutral-600'}`}>{rank + 1}.</span>
                <span className={`min-w-[8rem] flex-1 break-words ${rank < TOP && e.count > 0 ? 'font-semibold' : ''}`}>
                  {e.text}
                  {e.idea && <span className="block text-xs font-normal text-sky-300">{name(e.idea.by)} нэмсэн</span>}
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-neutral-400">
                  {e.count} · {pct}%
                </span>
                {e.idea && (
                  <button
                    type="button"
                    onClick={() => confirm(`«${e.text}» санааг устгах уу? Түүнд өгсөн саналууд тоологдохоо болино.`) && deleteIdea(poll.id, e.idea!.iid).catch((err) => alert(err.message))}
                    aria-label="Санааг устгах"
                    className="shrink-0 self-center rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="ml-7 mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full rounded-full bg-violet-400" style={{width: `${pct}%`}} />
              </div>
            </li>
          );
        })}
        {all && ideas && !list.length && <li className="text-sm text-neutral-500">Одоохондоо санаа алга.</li>}
      </ul>
      {comments.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-neutral-400">Багшид бичсэн ({comments.length})</p>
          {comments.map((s) => (
            <p key={s.uid} className="rounded-xl bg-neutral-800/60 px-3 py-2 text-sm break-words">
              <span className="font-medium">{s.profile.name}:</span> <span className="whitespace-pre-wrap text-neutral-200">{said(s.uid)!.t}</span>
            </p>
          ))}
        </div>
      )}
      {who && all && (
        <div className="mt-3 space-y-2 text-sm">
          {list.map((e) => (
            <p key={e.key}>
              <span className="text-neutral-400">{e.text}:</span>{' '}
              {Object.keys(all)
                .filter((uid) => picks(all[uid], e))
                .map(name)
                .join(', ') || '—'}
            </p>
          ))}
          <p>
            <span className="text-neutral-400">Хариулахгүй гэсэн ({declined.length}):</span> {declined.map((s) => s.profile.name).join(', ') || '—'}
          </p>
          <p>
            <span className="text-neutral-400">Хариулаагүй ({quiet.length}):</span> {quiet.map((s) => s.profile.name).join(', ') || '—'}
          </p>
        </div>
      )}
      {declined.length > 0 && !who && <p className="mt-2 text-xs text-neutral-500">{declined.length} сурагч «Хариулахгүй» гэсэн.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setWho(!who)} aria-expanded={who} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
          <ChevronDown size={14} className={`transition-transform ${who ? 'rotate-180' : ''}`} /> Хэн юу сонгосон
        </button>
        <button type="button" onClick={() => closePoll(poll.id, !poll.closed).catch((e) => alert(e.message))} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
          {poll.closed ? <LockOpen size={14} /> : <Lock size={14} />} {poll.closed ? 'Дахин нээх' : 'Хаах'}
        </button>
        <button
          type="button"
          onClick={() => confirm('Энэ асуулгыг хариулт, санаануудтай нь устгах уу?') && deletePoll(poll.id).catch((e) => alert(e.message))}
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
