import {BadgeCheck, Bell, BellRing, Bug, Check, ChevronDown, ChevronRight, HandHelping, LayoutDashboard, Megaphone, Send, Trash2, X} from 'lucide-react';
import {useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import AskedProblem, {problemHref} from '../components/AskedProblem';
import Loading from '../components/Loading';
import {LockedNote} from '../components/Notices';
import {ReasonPicker, reportText} from '../components/ReportMistake';
import {assignmentFor, assignmentTitle} from '../components/Today';
import {useAssignments, type Assignment} from '../lib/classroom';
import {useClasses} from '../lib/classes';
import {
  answerHelp,
  deleteClassNote,
  NOTES_EACH,
  nudge,
  postClassNote,
  remind,
  REMIND_GAP,
  sendReport,
  useClassNotes,
  useClassNudges,
  useClassWork,
  useHelpQueue,
  useMyReports,
  useReminders,
  useRoster,
  waitingHelp,
  withdrawHelp,
  withdrawReport,
  type HelpItem,
  type Nudge,
} from '../lib/lead';
import {formatDate, useMyResults} from '../lib/results';
import {Link, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {clock, dayLabel, serverNow, span, useNow} from '../lib/time';
import {forClassOf, problemNo, useTopics, type Topic} from '../lib/topics';
import {TESTS} from '../tests';

const DAY = 86_400_000;
const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-teal-400';
const primary = 'flex items-center gap-1.5 rounded-full bg-teal-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-teal-400 disabled:opacity-50';
const quiet = 'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800';
const sorry = (e: unknown) =>
  /permission/i.test((e as Error).message) ? 'Болсонгүй: багш энэ эрхийг унтраасан эсвэл таныг ангийн даргаас хассан байж магадгүй.' : (e as Error).message;
/** By the server's clock, as the rules count the 3 hours (a phone's own may be a little off). */
const waitFor = (last: number | undefined, now: number) => (last ? last + REMIND_GAP - Math.max(now, serverNow()) : 0);

/** The parts of the class leader's dashboard, each shown while the teacher has its power on. */
const TABS = [
  {id: 'overview', label: 'Тойм', icon: LayoutDashboard},
  {id: 'tasks', label: 'Даалгавар', icon: Bell},
  {id: 'notes', label: 'Зарлал', icon: Megaphone},
  {id: 'help', label: 'Туслах', icon: HandHelping},
  {id: 'reports', label: 'Алдаа', icon: Bug},
] as const;
type Tab = (typeof TABS)[number]['id'];
type On = Record<'tasks' | 'notes' | 'help' | 'reports', boolean>;

/**
 * /lead?tab=… — «Ангийн даргын самбар», for the students the teacher made class leaders only, laid out like the
 * teacher's dashboard: an overview (what is waiting, what each part is for), then a tab for each power the teacher has
 * on: see who has started each assignment and remind those who haven't (the class, or one by one), put up a note,
 * explain classmates' questions (straight to them), report a mistake in a problem.
 */
export default function LeadPage() {
  const session = useSession();
  const settings = useSettings();
  const classes = useClasses();
  const {query} = useLocation();
  const p = session.profile;
  const cls = p?.lead && !p.disabled && !session.admin ? p.class : undefined;
  const on: On = {tasks: !!settings?.leadRemind, notes: !!settings?.leadNotes, help: !!settings?.leadHelp, reports: !!settings?.leadReports};
  // For the overview and the tabs' badges.
  const queue = useHelpQueue(cls, on.help);
  const nav = useRef<HTMLElement>(null);
  const asked = query.get('tab');
  useEffect(() => {
    // On a phone the tabs scroll sideways: keep the open one in view.
    const el = nav.current?.querySelector<HTMLElement>('[aria-current=page]');
    const box = nav.current;
    if (el && box && (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth))
      box.scrollTo({left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2});
  }, [asked, cls]);
  if (!session.ready) return <Loading />;
  if (!session.user) return <LockedNote text="Нэвтэрнэ үү." />;
  if (!p || !cls) return <p className="py-24 text-center text-neutral-400">Энэ хэсэг зөвхөн багшийн сонгосон ангийн даргад.</p>;
  if (!settings) return <Loading />;
  const uid = session.user.uid;
  const name = p.name;
  const info = classes?.find((c) => c.id === cls);
  const tabs = TABS.filter((t) => t.id === 'overview' || on[t.id]);
  const tab: Tab = tabs.find((t) => t.id === asked)?.id ?? 'overview';
  const toHelp = waitingHelp(queue, uid, serverNow()).length;
  return (
    <div className="mx-auto max-w-5xl py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <BadgeCheck size={24} className="shrink-0 text-teal-300" /> Ангийн даргын самбар
        </h1>
        {info?.name && <span className="rounded-full bg-teal-500/15 px-3 py-1 text-sm font-medium text-teal-200">{info.name} анги</span>}
      </div>
      <nav ref={nav} className="relative -mx-4 mt-3 flex overflow-x-auto border-b border-neutral-800 px-4 [scrollbar-width:none] sm:mx-0 sm:gap-1 sm:px-0">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <Link
              key={t.id}
              href={t.id === 'overview' ? '/lead' : `/lead?tab=${t.id}`}
              aria-current={active ? 'page' : undefined}
              className={`relative -mb-px flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 border-b-2 px-2 py-2 text-xs font-medium sm:min-w-0 sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm ${active ? 'border-teal-400 text-neutral-50' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
            >
              <t.icon size={18} className="sm:h-4 sm:w-4" /> {t.label}
              {t.id === 'help' && toHelp > 0 && (
                <span className="absolute right-1 top-1 min-w-4 rounded-full bg-teal-400 px-1 text-center text-[10px] font-bold leading-4 text-black sm:static sm:ml-0.5">
                  {toHelp}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-5">
        {tabs.length === 1 ? (
          <p className="rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">Багш одоохондоо ангийн даргын эрхүүдийг унтраасан байна.</p>
        ) : tab === 'tasks' ? (
          <Tasks cls={cls} uid={uid} name={name} size={info?.n} />
        ) : tab === 'notes' ? (
          <Notes cls={cls} uid={uid} name={name} />
        ) : tab === 'help' ? (
          <Help cls={cls} uid={uid} name={name} />
        ) : tab === 'reports' ? (
          <Reports uid={uid} cls={cls} />
        ) : (
          <Overview cls={cls} uid={uid} size={info?.n} on={on} toHelp={toHelp} />
        )}
      </div>
    </div>
  );
}

/** What a part of the dashboard is for, above it. */
function Section({icon, title, sub, children}: {icon: ReactNode; title: string; sub: string; children: ReactNode}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4">
        <span className="mt-0.5 shrink-0 text-teal-300">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-neutral-400">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const Empty = ({children}: {children: ReactNode}) => <p className="rounded-2xl bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-400">{children}</p>;

// ---- the overview

/** The assignments the leader sees: given to the class, not more than a day past their time; soonest first. */
function useClassTasks(cls: string) {
  const assignments = useAssignments();
  const topics = useTopics();
  const now = useNow(60_000);
  if (!assignments || !topics) return null;
  return {topics, now, list: assignments.filter((a) => a.due > now - DAY && assignmentFor(a, topics, cls)).sort((a, b) => a.due - b.due)};
}

function Overview({cls, uid, size, on, toHelp}: {cls: string; uid: string; size?: number; on: On; toHelp: number}) {
  const tasks = useClassTasks(cls);
  const roster = useRoster(cls, on.tasks);
  const notes = useClassNotes(cls, on.notes);
  const reports = useMyReports(on.reports ? uid : undefined);
  const open = tasks?.list.filter((a) => a.due > tasks.now) ?? [];
  const mine = (notes ?? []).filter((n) => n.by === uid).length;
  const waiting = (reports ?? []).filter((r) => !r.done).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {on.tasks && (
          <Tile
            href="/lead?tab=tasks"
            icon={<Bell size={16} />}
            label="Даалгавар"
            value={tasks ? open.length : '…'}
            unit="идэвхтэй"
            sub="Хэн эхлээгүйг харж сануулна"
          />
        )}
        {on.help && (
          <Tile
            href="/lead?tab=help"
            icon={<HandHelping size={16} />}
            label="Туслах"
            value={toHelp}
            unit="асуулт"
            sub={toHelp ? 'таны тайлбарыг хүлээж байна' : 'Хүлээж буй асуулт алга'}
            lit={toHelp > 0}
          />
        )}
        {on.notes && (
          <Tile
            href="/lead?tab=notes"
            icon={<Megaphone size={16} />}
            label="Зарлал"
            value={notes ? `${mine}/${NOTES_EACH}` : '…'}
            unit="таных"
            sub={notes ? (notes.length ? `Ангид ${notes.length} зарлал байна` : 'Одоогоор зарлал алга') : ''}
          />
        )}
        {on.reports && (
          <Tile
            href="/lead?tab=reports"
            icon={<Bug size={16} />}
            label="Алдаа"
            value={reports ? waiting : '…'}
            unit="хүлээгдэж буй"
            sub={reports ? `${reports.length - waiting} нь багш зассан` : ''}
          />
        )}
      </div>

      {on.tasks && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="flex-1 font-semibold">Ойрын даалгавар</h2>
            <Link href="/lead?tab=tasks" className="flex items-center gap-0.5 text-sm text-teal-300 hover:underline">
              Бүгд <ChevronRight size={15} />
            </Link>
          </div>
          {!tasks ? (
            <Loading small />
          ) : !open.length ? (
            <Empty>Одоогоор ангид өгсөн идэвхтэй даалгавар алга.</Empty>
          ) : (
            <ul className="space-y-2">
              {open.slice(0, 3).map((a) => (
                <TaskLine key={a.id} a={a} topics={tasks.topics} cls={cls} roster={roster} size={size} now={tasks.now} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <h2 className="font-semibold">Ангийн дарга юу хийдэг вэ?</h2>
        <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {on.tasks && (
            <Power
              icon={<Bell size={16} />}
              title="Даалгаврын сануулга"
              text="Хэд нь эхэлж, дуусгасныг, хэн эхлээгүйг нэрээр нь харна. Ангидаа эсвэл эхлээгүй хүн бүрт тусад нь сануулга илгээнэ (3 цагт нэг удаа)."
            />
          )}
          {on.notes && (
            <Power icon={<Megaphone size={16} />} title="Ангийн зарлал" text="Ангийнхны нүүр хуудсанд 7 хоног харагдах зарлал тавина (нэг дор 3 хүртэл)." />
          )}
          {on.help && (
            <Power
              icon={<HandHelping size={16} />}
              title="Ангийнхандаа туслах"
              text="Ангийнхны асуултыг нэр, бодлоготой нь харж тайлбар бичнэ; тайлбар шууд асуусан хүнд очно."
            />
          )}
          {on.reports && (
            <Power
              icon={<Bug size={16} />}
              title="Бодлогын алдаа мэдээлэх"
              text="Бодлого бүрийн доорх «Алдаа мэдээлэх» товчоор эсвэл «Алдаа» хэсгээс хэдхэн товшилтоор багшид мэдээлнэ."
            />
          )}
        </ul>
      </section>
    </div>
  );
}

function Tile({
  href,
  icon,
  label,
  value,
  unit,
  sub,
  lit,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit: string;
  sub: string;
  lit?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl p-4 transition-colors ${lit ? 'bg-teal-500/15 ring-1 ring-teal-400/50 hover:bg-teal-500/20' : 'bg-neutral-900 hover:bg-neutral-800/80'}`}
    >
      <p className="flex items-center gap-1.5 text-sm text-neutral-400">
        <span className="text-teal-300">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight size={15} className="shrink-0 text-neutral-600 group-hover:text-neutral-400" />
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value} <span className="text-sm font-normal text-neutral-400">{unit}</span>
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </Link>
  );
}

function Power({icon, title, text}: {icon: ReactNode; title: string; text: string}) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl bg-neutral-800/50 p-3">
      <span className="mt-0.5 shrink-0 text-teal-300">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-neutral-400">{text}</span>
      </span>
    </li>
  );
}

/** How far the class is with an assignment, by the classmates' own pages and the class's list. */
function useProgressOf(cls: string, aid: string, roster: Record<string, string> | null, size?: number) {
  const work = useClassWork(cls, aid);
  if (!work) return null;
  const done = Object.values(work).filter((w) => w === 'done').length;
  const started = Object.values(work).filter((w) => w === 'started').length;
  const list = roster && Object.keys(roster).length ? roster : null;
  const total = Math.max(list ? Object.keys(list).length : (size ?? 0), done + started);
  // Who hasn't started, by name (when the class's list is there), A to Я.
  const missing = list
    ? Object.entries(list)
        .filter(([u]) => !work[u])
        .sort((a, b) => a[1].localeCompare(b[1], 'mn'))
    : null;
  return {done, started, total, missing, none: Math.max(0, total - done - started)};
}

/** One assignment on the overview: how far the class is, how long is left. */
function TaskLine({
  a,
  topics,
  cls,
  roster,
  size,
  now,
}: {
  a: Assignment;
  topics: Topic[];
  cls: string;
  roster: Record<string, string> | null;
  size?: number;
  now: number;
}) {
  const p = useProgressOf(cls, a.id, roster, size);
  return (
    <li>
      <Link href="/lead?tab=tasks" className="block rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800/80">
        <TaskHead a={a} topics={topics} now={now} />
        <WorkBar p={p} />
      </Link>
    </li>
  );
}

function TaskHead({a, topics, now}: {a: Assignment; topics: Topic[]; now: number}) {
  const left = a.due - now;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <span className="min-w-0 flex-1 font-medium break-words">
        <span className="text-neutral-400">{a.kind === 'test' ? 'Тест: ' : 'Сэдэв: '}</span>
        {assignmentTitle(a, topics)}
      </span>
      <span className={`shrink-0 text-xs ${left < 0 ? 'text-red-300' : left < DAY ? 'text-amber-300' : 'text-neutral-400'}`}>
        {left < 0 ? 'Хугацаа дууссан' : `${span(left)} үлдсэн`} · {dayLabel(a.due)} {clock(a.due)}
      </span>
    </div>
  );
}

/** Done, started and not started: a bar in three, and the three counts. */
function WorkBar({p}: {p: ReturnType<typeof useProgressOf>}) {
  if (!p) return <p className="mt-2 text-sm text-neutral-500">…</p>;
  const pct = (n: number) => (p.total ? `${(n / p.total) * 100}%` : '0%');
  return (
    <div className="mt-2">
      {p.total > 0 && (
        <div className="flex h-2 overflow-hidden rounded-full bg-neutral-800" aria-hidden>
          <span className="h-full bg-teal-400" style={{width: pct(p.done)}} />
          <span className="h-full bg-sky-400/70" style={{width: pct(p.started)}} />
        </div>
      )}
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
        <span className="text-teal-200">● Дуусгасан {p.done}</span>
        <span className="text-sky-200">● Эхэлсэн {p.started}</span>
        <span className="text-neutral-300">● Эхлээгүй {p.none}</span>
      </p>
    </div>
  );
}

// ---- assignments: who has started, reminders

function Tasks({cls, uid, name, size}: {cls: string; uid: string; name: string; size?: number}) {
  const tasks = useClassTasks(cls);
  const reminders = useReminders(cls);
  const roster = useRoster(cls);
  const nudges = useClassNudges(cls);
  if (!tasks || !reminders || !roster || !nudges) return <Loading small />;
  const open = tasks.list.filter((a) => a.due > tasks.now);
  const over = tasks.list.filter((a) => a.due <= tasks.now);
  const row = (a: Assignment) => (
    <TaskRow
      key={a.id}
      a={a}
      topics={tasks.topics}
      cls={cls}
      me={uid}
      name={name}
      size={size}
      roster={roster}
      nudges={nudges}
      last={reminders[a.id]?.at}
      now={tasks.now}
    />
  );
  return (
    <Section
      icon={<Bell size={20} />}
      title="Даалгавар"
      sub="Даалгавар бүрийг хэд нь эхэлж, дуусгасныг, хэн эхлээгүйг харна. Эхлээгүй хүн бүрт тусад нь, эсвэл дуусгаагүй бүх ангийнхандаа сануулга илгээнэ (3 цагт нэг удаа)."
    >
      {!tasks.list.length ? (
        <Empty>Одоогоор ангид өгсөн даалгавар алга.</Empty>
      ) : (
        <>
          {open.length > 0 && <ul className="space-y-2">{open.map(row)}</ul>}
          {over.length > 0 && (
            <>
              <h3 className="pt-2 text-sm font-semibold text-neutral-400">Хугацаа нь дууссан</h3>
              <ul className="space-y-2 opacity-80">{over.map(row)}</ul>
            </>
          )}
        </>
      )}
    </Section>
  );
}

function TaskRow(props: {
  a: Assignment;
  topics: Topic[];
  cls: string;
  me: string;
  name: string;
  size?: number;
  roster: Record<string, string>;
  nudges: Record<string, Record<string, Nudge>>;
  last?: number;
  now: number;
}) {
  const {a, topics, cls, me, name, size, roster, nudges, last, now} = props;
  const p = useProgressOf(cls, a.id, roster, size);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [shut, setShut] = useState(false);
  const over = now > a.due;
  const wait = waitFor(last, now);
  const run = async (key: string, f: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg('');
    try {
      await f();
      setMsg(ok);
    } catch (e) {
      setMsg(sorry(e));
    } finally {
      setBusy('');
    }
  };
  return (
    <li className="rounded-2xl bg-neutral-900 p-4">
      <TaskHead a={a} topics={topics} now={now} />
      <WorkBar p={p} />
      {p?.missing && p.missing.length > 0 && (
        <div className="mt-3 rounded-xl bg-neutral-800/50 p-3">
          <button type="button" onClick={() => setShut(!shut)} aria-expanded={!shut} className="flex w-full items-center gap-2 text-left text-sm font-semibold">
            <span className="flex-1">Эхлээгүй ({p.missing.length})</span>
            <ChevronDown size={16} className={`shrink-0 text-neutral-500 transition-transform ${shut ? '' : 'rotate-180'}`} />
          </button>
          {!shut && (
            <ul className="mt-2 divide-y divide-neutral-700/50">
              {p.missing.map(([u, who]) => {
                const n = nudges[u]?.[a.id];
                const left = waitFor(n?.at, now);
                return (
                  <li key={u} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
                    {/* On a narrow screen with big text the name keeps its room: what is beside it goes under it. */}
                    <span className="min-w-[7rem] flex-1 break-words">
                      {who}
                      {u === me && <span className="text-neutral-500"> (та)</span>}
                    </span>
                    {u === me || over ? null : left > 0 ? (
                      <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-neutral-400">
                        <Check size={13} className="text-teal-300" /> {clock(n!.at)}-д сануулсан
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => run(u, () => nudge(cls, u, a.id, name), `${who}-д сануулга илгээлээ.`)}
                        aria-label={`${who}-д сануулах`}
                        className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-teal-500/40 px-2.5 py-1 text-xs font-medium text-teal-200 hover:bg-teal-500/10 disabled:opacity-50"
                      >
                        <BellRing size={13} /> {busy === u ? '…' : 'Сануулах'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {p && !p.missing && p.none > 0 && <p className="mt-2 text-xs text-neutral-500">Эхлээгүй хүмүүсийн нэр багш самбараа нээхэд гарна.</p>}
      {!over && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {wait > 0 ? (
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <Check size={13} className="text-teal-300" /> Ангидаа {clock(last!)}-д сануулсан · {clock(last! + REMIND_GAP)}-аас дахин
            </span>
          ) : (
            <button
              type="button"
              onClick={() => run('all', () => remind(cls, a.id), 'Илгээлээ: дуусгаагүй ангийнхны хонхонд гарна.')}
              disabled={!!busy}
              className={primary}
            >
              <Bell size={14} /> {busy === 'all' ? 'Илгээж байна…' : 'Дуусгаагүй бүгдэд сануулах'}
            </button>
          )}
          {msg && <span className="text-xs text-neutral-400">{msg}</span>}
        </div>
      )}
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
    <Section
      icon={<Megaphone size={20} />}
      title="Ангийн зарлал"
      sub="Ангийн бүх сурагчийн нүүр хуудсанд таны нэртэй 7 хоног гарна (хонхонд ч). Багш харж, устгаж болно."
    >
      {mine.length < NOTES_EACH ? (
        <form onSubmit={post} className="space-y-2 rounded-2xl bg-neutral-900 p-4">
          <textarea
            value={text}
            maxLength={300}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            placeholder="Жишээ нь: Маргааш 2-р цагт тест бий, бэлдээрэй!"
            aria-label="Зарлал"
            className={`${field} resize-y`}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy || !text.trim()} className={primary}>
            <Megaphone size={14} /> {busy ? 'Тавьж байна…' : 'Зарлал тавих'}
          </button>
        </form>
      ) : (
        <p className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
          Танд {NOTES_EACH} зарлал байна. Шинийг тавихын тулд нэгийг нь устгана уу.
        </p>
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
                <button
                  type="button"
                  onClick={() => confirm('Энэ зарлалаа устгах уу?') && deleteClassNote(cls, n.nid).catch((e) => alert(sorry(e)))}
                  aria-label="Зарлалаа устгах"
                  className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                >
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
  // A test's question opens in the leader's own latest attempt of it (if any).
  const results = useMyResults();
  const [shut, setShut] = useState(true);
  if (!queue) return <Loading small />;
  // Not one's own questions.
  const list = queue.filter((h) => h.uid !== uid);
  const open = waitingHelp(list, uid, serverNow());
  const done = list.filter((h) => h.ans);
  const row = (h: HelpItem) => <HelpRow key={h.qid} cls={cls} uid={uid} name={name} item={h} href={h.ctx ? problemHref(h.ctx, results) : null} />;
  return (
    <Section
      icon={<HandHelping size={20} />}
      title="Ангийнхандаа туслах"
      sub="Ангийнхан тань багшаас асуусан, ангийн дарга ч тайлбарлаж болно гэсэн асуулт. Таны тайлбар шууд асуусан хүнд очно."
    >
      {!open.length ? <Empty>Одоогоор тайлбар хүлээж буй асуулт алга.</Empty> : <ul className="space-y-2">{open.map(row)}</ul>}
      {done.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShut(!shut)}
            aria-expanded={!shut}
            className="flex w-full items-center gap-2 py-1 text-left text-sm font-semibold text-neutral-400"
          >
            <span className="flex-1">Тайлбарласан ({done.length})</span>
            <ChevronDown size={16} className={`shrink-0 transition-transform ${shut ? '' : 'rotate-180'}`} />
          </button>
          {!shut && <ul className="mt-2 space-y-2">{done.map(row)}</ul>}
        </div>
      )}
    </Section>
  );
}

function HelpRow({cls, uid, name, item, href}: {cls: string; uid: string; name: string; item: HelpItem; href: string | null}) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const answer = item.ans;
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
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-500">
        <span className="text-sm font-semibold text-neutral-100">{item.name || 'Ангийн сурагч'}</span>
        <span>асуусан · {formatDate(item.at)}</span>
        <span className="font-medium text-neutral-300">{item.label}</span>
      </p>
      {/* The problem itself (a test's: in the leader's own attempt of it, if any). */}
      {item.ctx?.q !== undefined && <AskedProblem ctx={item.ctx} href={href} />}
      <p className="mt-3 text-xs font-semibold text-neutral-400">Асуулт</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-100 break-words">{item.text}</p>
      {answer && !editing ? (
        <div className="mt-3 rounded-xl bg-teal-500/10 p-3 text-sm">
          <p className="text-xs font-semibold text-teal-300">
            {mine ? 'Таны тайлбар' : `Ангийн дарга ${answer.name}-ийн тайлбар`} · {formatDate(answer.at)} · {item.name || 'асуусан хүн'}-д очсон
          </p>
          <p className="mt-1 whitespace-pre-wrap text-neutral-100 break-words">{answer.text}</p>
          {mine && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={() => setText(answer.text)} className={quiet}>
                Засах
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => confirm('Тайлбараа буцааж авах уу? Асуусан хүнд ч харагдахгүй болно.') && run(() => withdrawHelp(cls, item))}
                className={`${quiet} hover:text-red-300`}
              >
                Буцааж авах
              </button>
            </div>
          )}
        </div>
      ) : !item.uid ? (
        <p className="mt-3 text-xs text-neutral-500">Энэ асуулт сайтын хуучин хувилбараас асуугдсан тул энд тайлбар бичих боломжгүй.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={text ?? ''}
            maxLength={1000}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            placeholder="Тайлбараа бичнэ үү (хариуг шууд хэлэлгүй, бодох аргыг нь тайлбарлавал сайн)"
            aria-label="Тайлбар"
            className={`${field} resize-y`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !text?.trim()} onClick={() => run(() => answerHelp(cls, item, name, text!))} className={primary}>
              <Send size={14} /> {busy ? 'Илгээж байна…' : `${item.name || 'Асуусан хүн'}-д илгээх`}
            </button>
            {editing && answer && (
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
  const [n, setN] = useState(0);
  const [reason, setReason] = useState('');
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!topics || !mine) return <Loading small />;
  const open = topics.filter((t) => forClassOf(t, cls) && t.problems.length);
  const [kind, ref] = source.split(':') as ['test' | 'topic', string];
  const topic = kind === 'topic' ? open.find((t) => t.id === ref) : undefined;
  const test = kind === 'test' ? TESTS.find((t) => t.id === ref) : undefined;
  const count = test?.count ?? topic?.problems.length ?? 0;
  // The problem picked, by its number: a test's by its place, a topic's by its own number.
  const numberOf = (i: number) => (topic ? problemNo(topic.problems[i], i) : i + 1);
  const label = n ? `${test?.title ?? topic?.title} · ${numberOf(n - 1)}-р бодлого` : '';
  const ctx = n ? (test ? {s: 't' as const, t: test.id, q: String(n - 1)} : topic ? {s: 'p' as const, t: topic.id, q: topic.problems[n - 1].id} : null) : null;
  const text = reportText(reason, words);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ctx || !text) return;
    setBusy(true);
    setMsg('');
    try {
      await sendReport({kind, ref, q: kind === 'test' ? String(n) : ctx.q, label, text});
      setN(0);
      setReason('');
      setWords('');
      setMsg('Багшид илгээлээ. Баярлалаа!');
    } catch (err) {
      setMsg(sorry(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section
      icon={<Bug size={20} />}
      title="Бодлогын алдаа мэдээлэх"
      sub="Бодлого бүрийн доорх «Алдаа мэдээлэх» товчоор шууд мэдээлж болно. Эсвэл энд: тест, сэдвээ сонгоод, бодлогын дугаар дээр дарж, юу нь буруугаа сонгоно."
    >
      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-neutral-900 p-4">
        <p className="text-sm font-semibold">1. Аль тест, сэдэв вэ?</p>
        <select value={source} onChange={(e) => (setSource(e.target.value), setN(0), setMsg(''))} aria-label="Аль тест, сэдэв" className={field}>
          <option value="">Сонгох…</option>
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
        {count > 0 && (
          <>
            <p className="text-sm font-semibold">2. Аль бодлого вэ?</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5" role="group" aria-label="Бодлогын дугаар">
              {Array.from({length: count}, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setN(n === i + 1 ? 0 : i + 1)}
                  aria-pressed={n === i + 1}
                  className={`h-9 rounded-lg text-sm font-semibold tabular-nums ${n === i + 1 ? 'bg-amber-400 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                >
                  {numberOf(i)}
                </button>
              ))}
            </div>
          </>
        )}
        {ctx && (
          <>
            <AskedProblem ctx={ctx} />
            <p className="text-sm font-semibold">3. Юу нь буруу вэ?</p>
            <ReasonPicker reason={reason} setReason={setReason} words={words} setWords={setWords} />
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={busy || !ctx || !text} className={primary}>
            <Send size={14} /> {busy ? 'Илгээж байна…' : 'Багшид илгээх'}
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.done ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}
                  >
                    {r.done ? 'Багш зассан' : 'Хүлээгдэж байна'}
                  </span>
                </span>
                <span className="mt-1 block whitespace-pre-wrap text-sm text-neutral-100 break-words">{r.text}</span>
              </span>
              {!r.done && (
                <button
                  type="button"
                  onClick={() => confirm('Энэ мэдээллээ буцааж авах уу?') && withdrawReport(r.rid).catch((e) => alert(sorry(e)))}
                  aria-label="Буцааж авах"
                  className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                >
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
