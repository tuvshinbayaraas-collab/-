import {CheckCircle2, ChevronDown, ClipboardList, Megaphone, School, Send, Timer, Trash2} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {assignmentState, assignmentTitle, dueLeft} from '../../components/Today';
import {createAssignment, deleteAnnouncement, deleteAssignment, postAnnouncement, useAnnouncements, useAssignments} from '../../lib/classroom';
import {useClasses} from '../../lib/classes';
import {forClass} from '../../lib/live';
import {clock, dayLabel, useNow} from '../../lib/time';
import {attemptTime, timeText, topicTimeKey, useAllTimeOn, type TimeOn} from '../../lib/timeOn';
import {problemNo, useAllProgress, useTopics, type Topic} from '../../lib/topics';
import type {Assignment} from '../../lib/classroom';
import type {Result} from '../../lib/results';
import {TESTS} from '../../tests';
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
    </div>
  );
}

/**
 * How long a student took over an assignment (seen only by the teacher; lib/timeOn): a topic's whole time on its page and
 * each problem's until answered; a test's handed-in attempt (or the one going on), and each question's. Null: none yet.
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
  return {all: r ? r.seconds : t!.all, q};
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
    try {
      await createAssignment({kind, ref: chosen, due: at, classes: asMap(to)});
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
