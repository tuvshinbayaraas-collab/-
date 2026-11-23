import {Bot, ChevronDown, ExternalLink, GitBranch, Loader2, RotateCcw, Send, Trash2, Upload, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {
  addAgentNote,
  addAgentTask,
  approveAgentTask,
  MAX_NOTE,
  MAX_TEXT,
  REPO,
  rejectAgentTask,
  removeAgentTask,
  retryAgentTask,
  SITE_BRANCH,
  TEAMS,
  useAgentRunner,
  useAgentTasks,
  type AgentRunner,
  type AgentStatus,
  type AgentTask,
} from '../../lib/agents';
import {clock, dayLabel, useNow} from '../../lib/time';
import Loading from '../../components/Loading';

const STATUS: Record<AgentStatus, {label: string; tone: string}> = {
  new: {label: 'Дараалалд', tone: 'bg-neutral-800 text-neutral-300'},
  working: {label: 'Хийж байна', tone: 'bg-blue-500/15 text-blue-300'},
  review: {label: 'Таны шийдвэр', tone: 'bg-amber-500/15 text-amber-300'},
  approved: {label: 'Push хийхээр', tone: 'bg-blue-500/15 text-blue-300'},
  pushing: {label: 'Push хийж байна', tone: 'bg-blue-500/15 text-blue-300'},
  pushed: {label: 'Сайтад гарсан', tone: 'bg-green-500/15 text-green-300'},
  rejected: {label: 'Татгалзсан', tone: 'bg-neutral-800 text-neutral-400'},
  failed: {label: 'Амжилтгүй', tone: 'bg-red-500/15 text-red-300'},
};
const ACTIVE: AgentStatus[] = ['review', 'failed', 'new', 'working', 'approved', 'pushing'];
/** The runner looks in every 10 minutes (GitHub is sometimes late): not seen for longer than this, something is wrong. */
const QUIET = 45 * 60_000;
const DRAFT = 'batnab.agentDraft';

const when = (ts: number) => `${dayLabel(ts)} ${clock(ts)}`;
const money = (usd: number) => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`;
/** "саяхан", "4 минутын өмнө", "3 цагийн өмнө", "2 өдрийн өмнө". */
function ago(ms: number) {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'саяхан';
  if (m < 60) return `${m} минутын өмнө`;
  if (m < 1440) return `${Math.floor(m / 60)} цагийн өмнө`;
  return `${Math.floor(m / 1440)} өдрийн өмнө`;
}
/** "12 минут", "1 цаг 5 минут". */
function long(ms: number) {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m < 60 ? `${m} минут` : `${Math.floor(m / 60)} цаг${m % 60 ? ` ${m % 60} минут` : ''}`;
}

function readDraft() {
  try {
    return localStorage.getItem(DRAFT) ?? '';
  } catch {
    return '';
  }
}
function keepDraft(text: string) {
  try {
    if (text) localStorage.setItem(DRAFT, text);
    else localStorage.removeItem(DRAFT);
  } catch {
    // private window: the draft lives only as long as the page
  }
}

/**
 * The teacher's agents: a request written here is read by the managing agent, who hands it to the right team's lead;
 * the lead does the work on GitHub, on a branch of its own, and reports. The site changes only when the teacher
 * pushes the work («Push хийх»).
 */
export default function AgentTab() {
  const tasks = useAgentTasks();
  const runner = useAgentRunner();
  const now = useNow(30_000);
  const [show, setShow] = useState<'active' | 'done'>('active');
  if (!tasks || runner === null) return <Loading small />;
  const active = tasks.filter((t) => ACTIVE.includes(t.status)).sort((a, b) => ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status) || b.at - a.at);
  const done = tasks.filter((t) => !ACTIVE.includes(t.status));
  const shown = show === 'active' ? active : done;
  const busy = tasks.some((t) => t.status === 'working');
  const chip = (s: 'active' | 'done', label: string, n: number) => (
    <button
      type="button"
      onClick={() => setShow(s)}
      aria-pressed={show === s}
      className={`rounded-full px-3 py-1 text-sm ${show === s ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
    >
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );
  return (
    <div className="max-w-3xl space-y-4" data-agent-tab>
      <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Bot size={18} className="text-blue-300" /> Agent
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Сайтад юу нэмэх, юуг засахаа энд бичнэ. Удирдах agent уншаад тохирох багийн ахлахад өгнө. Ахлах нь ажлыг сайтаас тусад нь хийгээд юу хийснээ бичнэ.
          Та урьдчилан харж шалгаад «Push хийх» дарвал сайтад гарна. Түүнээс өмнө сайт өөрчлөгдөхгүй.
        </p>
        <p className="mt-2 text-xs text-neutral-500">Багууд: {Object.values(TEAMS).join(' · ')}</p>
        <RunnerState runner={runner} now={now} />
      </section>

      <Composer canStart={!!runner && runner.claude} busy={busy} />

      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Шүүх">
          {chip('active', 'Идэвхтэй', active.length)}
          {chip('done', 'Дууссан', done.length)}
        </div>
      )}
      {!tasks.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Одоогоор даалгавар алга.</p>
      ) : !shown.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">{show === 'active' ? 'Хийгдэж буй даалгавар алга.' : 'Дууссан даалгавар алга.'}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => (
            <TaskCard key={t.id} task={t} now={now} queued={busy && t.status === 'new'} />
          ))}
        </ul>
      )}

      <SetupHelp open={!runner || !runner.claude} />
    </div>
  );
}

function RunnerState({runner, now}: {runner: AgentRunner | false; now: number}) {
  const box = 'mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm';
  if (!runner)
    return (
      <p className={`${box} bg-amber-500/10 text-amber-200`} data-runner="off">
        Agent хараахан ажиллаж эхлээгүй байна. GitHub дээр нэг удаа тохируулах хэрэгтэй. Доорх зааврыг үзнэ үү.
      </p>
    );
  const seen = ago(now - runner.lastSeen);
  if (now - runner.lastSeen > QUIET)
    return (
      <p className={`${box} bg-amber-500/10 text-amber-200`} data-runner="quiet">
        Agent сүүлд {seen} ажилласан. GitHub дээр зогссон байж магадгүй.
      </p>
    );
  if (!runner.claude)
    return (
      <p className={`${box} bg-amber-500/10 text-amber-200`} data-runner="nokey">
        Claude-ийн түлхүүр нэмэгдээгүй байна. Шинэ даалгавар эхлэхгүй. Push хийх, татгалзах нь ажиллана.
      </p>
    );
  return (
    <p className={`${box} bg-green-500/10 text-green-200`} data-runner="on">
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />
      Agent ажиллаж байна. Сүүлд {seen} шалгасан.
    </p>
  );
}

function Composer({canStart, busy}: {canStart: boolean; busy: boolean}) {
  const [text, setText] = useState(readDraft);
  const [state, setState] = useState<{ok: boolean; text: string} | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => keepDraft(text), [text]);
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    setState(null);
    try {
      await addAgentTask(text);
      setText('');
      setState({ok: true, text: busy ? 'Илгээлээ. Өмнөх даалгавар дуусмагц эхэлнэ.' : 'Илгээлээ. 10–20 минутын дотор эхэлнэ.'});
    } catch (e) {
      setState({ok: false, text: `Илгээж чадсангүй: ${(e as Error).message}`});
    } finally {
      setSending(false);
    }
  };
  return (
    <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
      <label htmlFor="agent-text" className="font-semibold">
        Шинэ даалгавар
      </label>
      <textarea
        id="agent-text"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
        rows={4}
        placeholder="Жишээ нь: Тоглоом хэсэгт бутархайн тоглоом нэм. Түвшин нь аажмаар хүндэрдэг байх."
        className="mt-2 w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-[15px] outline-none placeholder:text-neutral-500 focus:border-blue-500"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={sending || !text.trim()}
          className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Илгээх
        </button>
        <span className="text-xs tabular-nums text-neutral-500">
          {text.length}/{MAX_TEXT}
        </span>
      </div>
      {state && (
        <p role="status" className={`mt-2 text-sm ${state.ok ? 'text-green-300' : 'text-red-300'}`}>
          {state.text}
        </p>
      )}
      {!canStart && <p className="mt-2 text-sm text-amber-200">Тохиргоо дуусахаас өмнө илгээсэн даалгавар хүлээгээд байна.</p>}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-500">
        <li>Нэг даалгаварт нэг ажил бичвэл сайн болно. Даалгаврууд дарааллаараа нэг нэгээр хийгдэнэ.</li>
        <li>Сурагчийн нэр, нууц үг бүү бичээрэй. Agent-ийн хийсэн код GitHub дээр бүх хүнд харагддаг.</li>
      </ul>
    </section>
  );
}

const CHANGE: Record<string, string> = {A: 'нэмсэн', M: 'зассан', D: 'устгасан'};

function TaskCard({task: t, now, queued}: {task: AgentTask; now: number; queued: boolean}) {
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const files = t.result?.files ?? [];
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await f();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const push = () => confirm('Энэ өөрчлөлтийг сайтад гаргах уу? Хэдэн минутын дараа бүх хүнд шинэ хувилбар нь харагдана.') && void run(() => approveAgentTask(t.id));
  const reject = (ask: string) => confirm(ask) && void run(() => rejectAgentTask(t.id));
  const remove = () => confirm('Энэ даалгаврыг жагсаалтаас устгах уу?') && void run(() => removeAgentTask(t.id));
  const sendNote = async () => {
    if (note.trim() && (await run(() => addAgentNote(t.id, note)))) {
      setNote('');
      setNoting(false);
    }
  };
  const btn = 'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50';
  return (
    <li className="rounded-2xl bg-neutral-900 p-4 sm:p-5" data-task={t.id} data-status={t.status}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[t.status].tone}`}>{STATUS[t.status].label}</span>
        <span className="text-xs text-neutral-500">{when(t.at)}</span>
        {t.spent > 0 && <span className="ml-auto text-xs tabular-nums text-neutral-500">Зардал {money(t.spent)}</span>}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words">{t.text}</p>
      {t.notes.map((n, i) => (
        <p key={i} className="mt-1.5 whitespace-pre-wrap break-words border-l-2 border-neutral-700 pl-3 text-sm text-neutral-300">
          <span className="text-neutral-500">Нэмэлт {i + 1}: </span>
          {n.text}
        </p>
      ))}
      {t.route && (
        <p className="mt-2 text-sm text-neutral-400">
          Удирдах agent → <span className="font-medium text-neutral-200">{TEAMS[t.route.team] ?? t.route.team}</span> багийн ахлах.{t.route.why && ` ${t.route.why}`}
        </p>
      )}

      {t.status === 'new' && <p className="mt-2 text-sm text-neutral-400">{queued ? 'Өмнөх даалгавар дуусахыг хүлээж байна.' : '10–20 минутын дотор эхэлнэ.'}</p>}
      {t.status === 'working' && (
        <p className="mt-2 flex items-center gap-2 text-sm text-blue-200">
          <Loader2 size={15} className="animate-spin" /> {t.startedAt ? `Ажиллаж эхлээд ${long(now - t.startedAt)} болж байна` : 'Ажиллаж байна'}. Ихэвчлэн 10–40 минут болдог.
        </p>
      )}
      {(t.status === 'approved' || t.status === 'pushing') && (
        <p className="mt-2 flex items-center gap-2 text-sm text-blue-200">
          <Loader2 size={15} className="animate-spin" /> Сайтад гаргаж байна. 10–20 минут болно.
        </p>
      )}
      {t.status === 'pushed' && t.pushedAt && <p className="mt-2 text-sm text-green-300">{when(t.pushedAt)}-д сайтад гаргахаар илгээсэн.</p>}
      {t.error && t.status === 'failed' && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{t.error}</p>}

      {t.result && t.status !== 'failed' && <Result task={t} />}

      {t.log.length > 0 && (
        <details className="group mt-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-neutral-400 hover:text-neutral-200">
            <ChevronDown size={15} className="transition-transform group-open:rotate-180" /> Явц
          </summary>
          <ol className="mt-2 space-y-1 border-l border-neutral-800 pl-3">
            {t.log.map((l, i) => (
              <li key={i} className="text-neutral-400">
                <span className="tabular-nums text-neutral-500">{clock(l.at)}</span> {l.text}
              </li>
            ))}
          </ol>
        </details>
      )}

      {noting && (
        <div className="mt-3">
          <label htmlFor={`note-${t.id}`} className="text-sm font-medium">
            Юуг өөрчлөх, нэмэхээ бичнэ үү
          </label>
          <textarea
            id={`note-${t.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
            rows={3}
            className="mt-1 w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-[15px] outline-none focus:border-blue-500"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={sendNote} disabled={busy || !note.trim()} className={`${btn} bg-blue-500 text-black hover:bg-blue-400`}>
              <Send size={15} /> Илгээх
            </button>
            <button type="button" onClick={() => setNoting(false)} className={`${btn} text-neutral-300 hover:bg-neutral-800`}>
              Болих
            </button>
          </div>
        </div>
      )}

      {!noting && (
        <div className="mt-3 flex flex-wrap gap-2">
          {t.status === 'review' && files.length > 0 && (
            <button type="button" onClick={push} disabled={busy} className={`${btn} bg-green-500 text-black hover:bg-green-400`}>
              <Upload size={15} /> Push хийх
            </button>
          )}
          {(t.status === 'review' || t.status === 'failed') && (
            <button type="button" onClick={() => setNoting(true)} disabled={busy} className={`${btn} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}>
              <Send size={15} /> {files.length ? 'Засвар хэлэх' : 'Нэмэлт хэлэх'}
            </button>
          )}
          {t.status === 'failed' && (
            <button type="button" onClick={() => void run(() => retryAgentTask(t.id))} disabled={busy} className={`${btn} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}>
              <RotateCcw size={15} /> Дахин оролдох
            </button>
          )}
          {t.status === 'review' && (
            <button
              type="button"
              onClick={() => reject(files.length ? 'Энэ ажлыг татгалзах уу? Agent-ийн хийсэн өөрчлөлт устна.' : 'Энэ даалгаврыг хаах уу?')}
              disabled={busy}
              className={`${btn} text-neutral-300 hover:bg-neutral-800 hover:text-red-300`}
            >
              <X size={15} /> {files.length ? 'Татгалзах' : 'Хаах'}
            </button>
          )}
          {(t.status === 'new' || t.status === 'failed') && (
            <button type="button" onClick={() => reject('Энэ даалгаврыг болих уу?')} disabled={busy} className={`${btn} text-neutral-300 hover:bg-neutral-800 hover:text-red-300`}>
              <X size={15} /> Болих
            </button>
          )}
          {(t.status === 'pushed' || (t.status === 'rejected' && t.cleaned)) && (
            <button type="button" onClick={remove} disabled={busy} className={`${btn} text-neutral-400 hover:bg-neutral-800 hover:text-red-300`}>
              <Trash2 size={15} /> Устгах
            </button>
          )}
          {t.status === 'rejected' && !t.cleaned && <span className="text-sm text-neutral-500">Цэвэрлэж байна…</span>}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-300">Болсонгүй: {error}</p>}
    </li>
  );
}

function Result({task: t}: {task: AgentTask}) {
  const r = t.result!;
  const deciding = t.status === 'review';
  // The work's code: on its branch until it is pushed (the branch then goes), in the site's history after.
  const code = !r.files.length
    ? null
    : t.status === 'pushed'
      ? t.pushedCommit && `${REPO}/commit/${t.pushedCommit}`
      : ['review', 'approved', 'pushing'].includes(t.status)
        ? `${REPO}/compare/${SITE_BRANCH}...${r.branch}`
        : null;
  return (
    <div className="mt-3 rounded-xl border border-neutral-800 p-3 sm:p-4" data-result>
      <h3 className="text-sm font-semibold">Ахлахын тайлан</h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-300">{r.summary}</p>
      {r.files.length ? (
        <details className="group mt-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-neutral-400 hover:text-neutral-200">
            <ChevronDown size={15} className="transition-transform group-open:rotate-180" /> Өөрчилсөн файл: {r.files.length}
          </summary>
          <ul className="mt-2 space-y-0.5">
            {r.files.map((f) => {
              const [code, ...rest] = f.split('\t');
              const path = rest.join('\t') || code;
              return (
                <li key={f} className="flex gap-2 text-neutral-400">
                  <span className="w-16 shrink-0 text-neutral-500">{CHANGE[code[0]] ?? code}</span>
                  <span className="min-w-0 break-all font-mono text-xs leading-5">{path}</span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">Сайтад өөрчлөлт хийгээгүй.</p>
      )}
      {r.restored.length > 0 && (
        <p className="mt-2 text-sm text-amber-200">Agent-ийн өөрчлөх эрхгүй файлыг хэвээр нь үлдээлээ: {r.restored.join(', ')}</p>
      )}
      {code && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.preview && deciding && (
            <a href={r.preview} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-4 py-1.5 text-sm font-medium text-blue-300 hover:bg-blue-500/25">
              <ExternalLink size={15} /> Урьдчилан харах
            </a>
          )}
          <a href={code} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800">
            <GitBranch size={15} /> Кодыг GitHub дээр харах
          </a>
        </div>
      )}
      {r.preview && deciding && (
        <p className="mt-2 text-xs text-neutral-500">
          Урьдчилан харах хуудас жинхэнэ сайтын өгөгдлийг ашигладаг. Тэнд нэвтэрч юм өөрчилбөл жинхэнэ сайтад хадгалагдана. 7 хоногийн дараа хаагдана.
        </p>
      )}
    </div>
  );
}

function SetupHelp({open}: {open: boolean}) {
  return (
    <details open={open} className="group rounded-2xl bg-neutral-900 p-4 text-sm text-neutral-400 sm:p-5" data-setup>
      <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-neutral-100">
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" /> Тохируулах заавар
      </summary>
      <p className="mt-2">Agent нь GitHub дээр Claude-ээр ажилладаг. Нэг удаа ингэж тохируулна:</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        <li>
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
            console.anthropic.com
          </a>{' '}
          дээр нэвтэрч API түлхүүр (API key) үүсгэнэ. Дансаа цэнэглэнэ.
        </li>
        <li>
          GitHub дээр сайтын репо руу орно:{' '}
          <a href={`${REPO}/settings/secrets/actions`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
            Settings → Secrets and variables → Actions
          </a>
          . «New repository secret» дарж нэрийг нь <code className="rounded bg-neutral-800 px-1 text-neutral-200">ANTHROPIC_API_KEY</code>, утгыг нь түлхүүр болгоно.
        </li>
        <li>Хэдэн минутын дараа энд «Agent ажиллаж байна» гэж гарна.</li>
      </ol>
      <p className="mt-3">
        Зардал нь даалгаврын хэмжээнээс хамаарна. Жижиг засвар ихэвчлэн 1–3 доллар, том ажил 5–10 доллар орчим болно. Даалгавар бүрийн зардал карт дээр нь гарна.
      </p>
      <p className="mt-2">
        Явцыг{' '}
        <a href={`${REPO}/actions/workflows/batnab-agent.yml`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
          GitHub Actions
        </a>{' '}
        хуудсаас харж болно.
      </p>
    </details>
  );
}
