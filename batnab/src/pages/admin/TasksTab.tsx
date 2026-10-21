import {CheckCircle2, ClipboardList, Megaphone, School, Send, Trash2} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {assignmentState, assignmentTitle, dueLeft} from '../../components/Today';
import {createAssignment, deleteAnnouncement, deleteAssignment, postAnnouncement, useAnnouncements, useAssignments} from '../../lib/classroom';
import {useClasses} from '../../lib/classes';
import {forClass} from '../../lib/live';
import {clock, dayLabel, useNow} from '../../lib/time';
import {useAllProgress, useTopics} from '../../lib/topics';
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
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`flex-1 rounded-full px-3 py-1.5 font-medium ${kind === k ? 'bg-neutral-600 text-white' : 'text-neutral-400'}`}>
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
                  <div className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    {rows
                      .sort((x, y) => Number(x.st.done) - Number(y.st.done) || x.s.profile.name.localeCompare(y.s.profile.name, 'mn'))
                      .map(({s, st}) => (
                        <span key={s.uid} className="flex items-center gap-2">
                          {st.done ? <CheckCircle2 size={14} className="text-green-400" /> : <span className={`h-3.5 w-3.5 rounded-full border-2 ${over ? 'border-red-400' : 'border-neutral-600'}`} />}
                          <span className={st.done ? 'text-neutral-400' : ''}>{s.profile.name}</span>
                          {st.late && <span className="text-xs text-amber-300">хоцорсон</span>}
                          {!st.done && a.kind === 'topic' && st.total > 0 && st.count > 0 && (
                            <span className="text-xs text-neutral-500">
                              {st.count}/{st.total}
                            </span>
                          )}
                        </span>
                      ))}
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
