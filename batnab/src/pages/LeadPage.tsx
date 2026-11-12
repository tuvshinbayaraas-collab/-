import {BadgeCheck, Bell, Bug, Check, HandHelping, Megaphone, Send, Trash2, X} from 'lucide-react';
import {useState, type FormEvent, type ReactNode} from 'react';
import Loading from '../components/Loading';
import {LockedNote} from '../components/Notices';
import {assignmentFor, assignmentTitle} from '../components/Today';
import {useAssignments, type Assignment} from '../lib/classroom';
import {useClasses} from '../lib/classes';
import {
  answerHelp,
  deleteClassNote,
  NOTES_EACH,
  postClassNote,
  remind,
  REMIND_GAP,
  sendReport,
  useClassNotes,
  useDoneCount,
  useHelpAnswers,
  useHelpQueue,
  useMyReports,
  useReminders,
  withdrawHelp,
  withdrawReport,
} from '../lib/lead';
import {formatDate} from '../lib/results';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {clock, dayLabel, serverNow, useNow} from '../lib/time';
import {forClassOf, problemNo, useTopics, type Topic} from '../lib/topics';
import {TESTS} from '../tests';

const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-teal-400';
const primary = 'flex items-center gap-1.5 rounded-full bg-teal-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-teal-400 disabled:opacity-50';
const sorry = (e: unknown) => (/permission/i.test((e as Error).message) ? 'Болсонгүй: багш энэ эрхийг унтраасан эсвэл таныг ангийн даргаас хассан байж магадгүй.' : (e as Error).message);

/**
 * /lead — «Ангийн даргын хэсэг», for the students the teacher made class leaders only: remind the class of an
 * assignment, put up a note, answer classmates' questions (the teacher lets the answer through) and report a mistake in a
 * problem. Never a classmate's name, answer or score: counts only; everything they do, the teacher sees.
 */
export default function LeadPage() {
  const session = useSession();
  const settings = useSettings();
  const classes = useClasses();
  if (!session.ready) return <Loading />;
  if (!session.user) return <LockedNote text="Нэвтэрнэ үү." />;
  const p = session.profile;
  const cls = p?.class;
  if (!p || p.disabled || session.admin || !p.lead || !cls) return <p className="py-24 text-center text-neutral-400">Энэ хэсэг зөвхөн багшийн сонгосон ангийн даргад.</p>;
  if (!settings) return <Loading />;
  const uid = session.user.uid;
  const name = p.name;
  const className = classes?.find((c) => c.id === cls)?.name ?? '';
  const none = !settings.leadRemind && !settings.leadNotes && !settings.leadHelp && !settings.leadReports;
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4 sm:py-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-300">
          <BadgeCheck size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Ангийн даргын хэсэг</h1>
          <p className="text-sm text-neutral-400">
            {className && `${className} анги · `}Ангийнхнаасаа хэн юу хийснийг харахгүй, зөвхөн тоо харна. Таны хийсэн бүхнийг багш харна.
          </p>
        </div>
      </header>
      {none && <p className="rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">Багш одоохондоо ангийн даргын эрхүүдийг унтраасан байна.</p>}
      {settings.leadRemind && <Reminders cls={cls} size={classes?.find((c) => c.id === cls)?.n} />}
      {settings.leadNotes && <Notes cls={cls} uid={uid} name={name} />}
      {settings.leadHelp && <Help cls={cls} uid={uid} name={name} />}
      {settings.leadReports && <Reports uid={uid} cls={cls} />}
    </div>
  );
}

function Section({icon, title, sub, children}: {icon: ReactNode; title: string; sub: string; children: ReactNode}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          {icon} {title}
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
      </div>
      {children}
    </section>
  );
}

// ---- reminders

function Reminders({cls, size}: {cls: string; size?: number}) {
  const now = useNow(60_000);
  const assignments = useAssignments();
  const topics = useTopics();
  const reminders = useReminders(cls);
  if (!assignments || !topics || !reminders) return <Loading small />;
  const list = assignments.filter((a) => a.due > now - 86_400_000 && assignmentFor(a, topics, cls));
  return (
    <Section icon={<Bell size={18} className="text-teal-300" />} title="Даалгаврын сануулга" sub="Хэд нь дуусгасныг харна (хэн гэдгийг биш). «Сануулга» дуусгаагүй ангийнхан бүрийн хонхонд очно, 3 цагт нэг удаа.">
      {!list.length ? (
        <p className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-neutral-400">Одоогоор ангид өгсөн даалгавар алга.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <ReminderRow key={a.id} a={a} topics={topics} cls={cls} size={size} last={reminders[a.id]?.at} now={now} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ReminderRow({a, topics, cls, size, last, now}: {a: Assignment; topics: Topic[]; cls: string; size?: number; last?: number; now: number}) {
  const done = useDoneCount(a.id, cls);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const total = Math.max(size ?? 0, done ?? 0);
  const pct = total ? Math.round(((done ?? 0) / total) * 100) : 0;
  // By the server's clock, as the rules count the 3 hours (a phone's own may be a little off).
  const wait = last ? last + REMIND_GAP - Math.max(now, serverNow()) : 0;
  const over = now > a.due;
  const send = async () => {
    setBusy(true);
    setMsg('');
    try {
      await remind(cls, a.id);
      setMsg('Илгээлээ: дуусгаагүй ангийнхны хонхонд гарна.');
    } catch (e) {
      setMsg(sorry(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-2xl bg-neutral-900 p-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-[10rem] flex-1 font-medium break-words">
          {a.kind === 'test' ? 'Тест: ' : 'Сэдэв: '}
          {assignmentTitle(a, topics)}
        </span>
        <span className={`ml-auto shrink-0 text-xs ${over ? 'text-red-300' : 'text-neutral-400'}`}>
          {dayLabel(a.due)} {clock(a.due)} хүртэл
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="shrink-0 tabular-nums text-neutral-200">
          {done === null ? '…' : done}
          {total ? `/${total}` : ''} дуусгасан
        </span>
        {total > 0 && (
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <span className="block h-full rounded-full bg-teal-400" style={{width: `${pct}%`}} />
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {over ? (
          <span className="text-xs text-neutral-500">Хугацаа дууссан</span>
        ) : wait > 0 ? (
          <span className="flex items-center gap-1 text-xs text-neutral-400">
            <Check size={13} className="text-teal-300" /> {clock(last!)}-д сануулсан · {clock(last! + REMIND_GAP)}-аас дахин
          </span>
        ) : (
          <button type="button" onClick={send} disabled={busy} className={primary}>
            <Bell size={14} /> {busy ? 'Илгээж байна…' : 'Сануулга илгээх'}
          </button>
        )}
        {msg && <span className="text-xs text-neutral-400">{msg}</span>}
      </div>
    </li>
  );
}

// ---- notes

function Notes({cls, uid, name}: {cls: string; uid: string; name: string}) {
  const notes = useClassNotes(cls);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!notes) return <Loading small />;
  const mine = notes.filter((n) => n.by === uid);
  const post = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (await postClassNote(cls, name, text, notes)) setText('');
    } catch (err) {
      setError(sorry(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section icon={<Megaphone size={18} className="text-teal-300" />} title="Ангийн зарлал" sub="Ангийн бүх сурагчийн нүүр хуудсанд таны нэртэй 7 хоног гарна (хонхонд ч). Багш харж, устгаж болно.">
      {mine.length < NOTES_EACH ? (
        <form onSubmit={post} className="space-y-2 rounded-2xl bg-neutral-900 p-4">
          <textarea value={text} maxLength={300} rows={2} onChange={(e) => setText(e.target.value)} placeholder="Жишээ нь: Маргааш 2-р цагт тест бий, бэлдээрэй!" aria-label="Зарлал" className={`${field} resize-y`} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy || !text.trim()} className={primary}>
            <Megaphone size={14} /> {busy ? 'Тавьж байна…' : 'Зарлал тавих'}
          </button>
        </form>
      ) : (
        <p className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-neutral-400">Танд {NOTES_EACH} зарлал байна. Шинийг тавихын тулд нэгийг нь устгана уу.</p>
      )}
      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.nid} className="flex items-start gap-2 rounded-2xl bg-neutral-900 p-4">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-neutral-500">
                  {n.by === uid ? 'Таны зарлал' : `Ангийн дарга ${n.name}`} · {dayLabel(n.at)} {clock(n.at)}
                </span>
                <span className="mt-1 block whitespace-pre-wrap text-sm text-neutral-100 break-words">{n.text}</span>
              </span>
              {n.by === uid && (
                <button type="button" onClick={() => confirm('Энэ зарлалаа устгах уу?') && deleteClassNote(cls, n.nid).catch((e) => alert(sorry(e)))} aria-label="Зарлалаа устгах" className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---- helping classmates

function Help({cls, uid, name}: {cls: string; uid: string; name: string}) {
  const queue = useHelpQueue(cls);
  const answers = useHelpAnswers(cls);
  if (!queue || !answers) return <Loading small />;
  return (
    <Section icon={<HandHelping size={18} className="text-teal-300" />} title="Ангийнхандаа туслах" sub="Ангийнхан тань багшаас асуусан асуулт (хэн асуусныг харахгүй). Таны тайлбарыг багш шалгаж, зөвшөөрвөл асуусан хүнд очно.">
      {!queue.length ? (
        <p className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-neutral-400">Одоогоор тайлбар хүлээж буй асуулт алга.</p>
      ) : (
        <ul className="space-y-2">
          {queue.map((h) => (
            <HelpRow key={h.qid} cls={cls} uid={uid} name={name} item={h} answer={answers[h.qid]} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function HelpRow({cls, uid, name, item, answer}: {cls: string; uid: string; name: string; item: {qid: string; text: string; label: string; at: number}; answer?: {by: string; text: string}}) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mine = answer?.by === uid;
  const editing = text !== null;
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await f();
      setText(null);
    } catch (e) {
      setError(sorry(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-2xl bg-neutral-900 p-4">
      <p className="text-xs text-neutral-500">
        Ангийн сурагч · {item.label} · {formatDate(item.at)}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-100 break-words">{item.text}</p>
      {answer && !editing ? (
        <div className="mt-3 rounded-xl bg-teal-500/10 p-3 text-sm">
          <p className="text-xs font-semibold text-teal-300">{mine ? 'Таны тайлбар — багш зөвшөөрөхийг хүлээж байна' : 'Өөр дарга тайлбар бичсэн'}</p>
          {mine && <p className="mt-1 whitespace-pre-wrap text-neutral-100 break-words">{answer.text}</p>}
          {mine && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={() => setText(answer.text)} className="rounded-full px-2.5 py-1 text-neutral-300 hover:bg-neutral-800">
                Засах
              </button>
              <button type="button" disabled={busy} onClick={() => run(() => withdrawHelp(cls, item.qid))} className="rounded-full px-2.5 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-red-300">
                Буцааж авах
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea value={text ?? ''} maxLength={1000} rows={3} onChange={(e) => setText(e.target.value)} placeholder="Тайлбараа бичнэ үү (хариуг шууд хэлэлгүй, бодох аргыг нь тайлбарлавал сайн)" aria-label="Тайлбар" className={`${field} resize-y`} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !text?.trim()} onClick={() => run(() => answerHelp(cls, item.qid, name, text!))} className={primary}>
              <Send size={14} /> {busy ? 'Илгээж байна…' : 'Багшид илгээх'}
            </button>
            {editing && (
              <button type="button" onClick={() => setText(null)} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800">
                Болих
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </li>
  );
}

// ---- reports of a mistake

function Reports({uid, cls}: {uid: string; cls: string}) {
  const topics = useTopics();
  const mine = useMyReports(uid);
  const [source, setSource] = useState('');
  const [no, setNo] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!topics || !mine) return <Loading small />;
  const open = topics.filter((t) => forClassOf(t, cls) && t.problems.length);
  const [kind, ref] = source.split(':') as ['test' | 'topic', string];
  const count = kind === 'test' ? (TESTS.find((t) => t.id === ref)?.count ?? 0) : kind === 'topic' ? (open.find((t) => t.id === ref)?.problems.length ?? 0) : 0;
  const n = Number(no);
  const ok = !!source && Number.isInteger(n) && n >= 1 && n <= count && text.trim().length > 0;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      let label = '';
      if (kind === 'test') label = `${TESTS.find((t) => t.id === ref)!.title} · ${n}-р бодлого`;
      else {
        const t = open.find((x) => x.id === ref)!;
        label = `${t.title} · ${problemNo(t.problems[n - 1], n - 1)}-р бодлого`;
      }
      await sendReport({kind, ref, q: String(n), label, text});
      setText('');
      setNo('');
      setMsg('Багшид илгээлээ. Баярлалаа!');
    } catch (err) {
      setMsg(sorry(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section icon={<Bug size={18} className="text-teal-300" />} title="Бодлогын алдаа мэдээлэх" sub="Тест, сэдвийн бодлогод алдаа (гээгдсэн тэмдэг, буруу сонголт, хариугүй бодлого…) олвол багшид мэдээлнэ.">
      <form onSubmit={submit} className="space-y-2 rounded-2xl bg-neutral-900 p-4">
        <div className="flex flex-wrap gap-2">
          <select value={source} onChange={(e) => (setSource(e.target.value), setNo(''))} aria-label="Аль тест, сэдэв" className={`${field} min-w-[12rem] flex-1`}>
            <option value="">Аль тест, сэдэв вэ?</option>
            <optgroup label="Тестүүд">
              {TESTS.map((t) => (
                <option key={t.id} value={`test:${t.id}`}>
                  {t.title}
                </option>
              ))}
            </optgroup>
            {open.length > 0 && (
              <optgroup label="Сэдвүүд">
                {open.map((t) => (
                  <option key={t.id} value={`topic:${t.id}`}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <input value={no} onChange={(e) => setNo(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder={count ? `1–${count}` : 'Дугаар'} aria-label="Бодлогын дугаар" className={`${field} w-28`} />
        </div>
        <textarea value={text} maxLength={500} rows={2} onChange={(e) => setText(e.target.value)} placeholder="Юу нь буруу вэ? Жишээ нь: В сонголтод хасах тэмдэг дутуу байна." aria-label="Алдааны тайлбар" className={`${field} resize-y`} />
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={busy || !ok} className={primary}>
            <Send size={14} /> {busy ? 'Илгээж байна…' : 'Илгээх'}
          </button>
          {msg && <span className="text-xs text-neutral-400">{msg}</span>}
        </div>
      </form>
      {mine.length > 0 && (
        <ul className="space-y-2">
          {mine.map((r) => (
            <li key={r.rid} className="flex items-start gap-2 rounded-2xl bg-neutral-900 p-4">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                  {r.label} · {formatDate(r.at)}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.done ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>{r.done ? 'Багш зассан' : 'Хүлээгдэж байна'}</span>
                </span>
                <span className="mt-1 block whitespace-pre-wrap text-sm text-neutral-100 break-words">{r.text}</span>
              </span>
              {!r.done && (
                <button type="button" onClick={() => confirm('Энэ мэдээллээ буцааж авах уу?') && withdrawReport(r.rid).catch((e) => alert(sorry(e)))} aria-label="Буцааж авах" className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
                  <X size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
