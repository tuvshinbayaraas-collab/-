import {Bot, ChevronDown, Loader2, ScanSearch, Trash2} from 'lucide-react';
import {useState} from 'react';
import {dropTask, REPO, removeTask, retryTask, RUN_NOW, useAgentRunner, useAgentTasks, type AgentRunner, type AgentStatus, type AgentTask} from '../../lib/agents';
import {Link} from '../../lib/router';
import {clock, dayLabel, useNow} from '../../lib/time';
import Loading from '../../components/Loading';

const STATUS: Record<AgentStatus, {label: string; tone: string}> = {
  new: {label: 'Дараалалд', tone: 'bg-neutral-800 text-neutral-300'},
  working: {label: 'Уншиж байна', tone: 'bg-blue-500/15 text-blue-300'},
  review: {label: 'Шалгах', tone: 'bg-amber-500/15 text-amber-300'},
  done: {label: 'Нэмсэн', tone: 'bg-green-500/15 text-green-300'},
  rejected: {label: 'Хаясан', tone: 'bg-neutral-800 text-neutral-400'},
  failed: {label: 'Амжилтгүй', tone: 'bg-red-500/15 text-red-300'},
};
const ACTIVE: AgentStatus[] = ['review', 'failed', 'working', 'new'];
/** The runner looks in every 5 minutes (GitHub is sometimes late): not seen for longer than this, something is wrong. */
const QUIET = 40 * 60_000;

const when = (ts: number) => `${dayLabel(ts)} ${clock(ts)}`;
/** "саяхан", "4 минутын өмнө", "3 цагийн өмнө", "2 өдрийн өмнө". */
function ago(ms: number) {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'саяхан';
  if (m < 60) return `${m} минутын өмнө`;
  if (m < 1440) return `${Math.floor(m / 60)} цагийн өмнө`;
  return `${Math.floor(m / 1440)} өдрийн өмнө`;
}

/**
 * The agent: it splits photographed book pages into problems. Pages are sent from a topic («Agent-аар хуваах»), and
 * checked and added there; this tab shows how the agent is doing, every request, and how to set it up.
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
          Agent нь номын хуудасны зураг эсвэл PDF-ийг уншаад бодлого бүрээр хуваана. Сэдэв эсвэл «Бодлого» хэсгийн хавтсанд «Agent-аар хуваах» дарж илгээнэ. Agent уншсаны
          дараа тэнд «Шалгаж нэмэх» гарна. Хуваасныг шалгаж, засаад нэмнэ. Таныг нэмэхээс өмнө юу ч нэмэгдэхгүй.
        </p>
        <RunnerState runner={runner} now={now} />
      </section>

      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Шүүх">
          {chip('active', 'Идэвхтэй', active.length)}
          {chip('done', 'Дууссан', done.length)}
        </div>
      )}
      {!tasks.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Одоогоор илгээсэн хуудас алга.</p>
      ) : !shown.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">{show === 'active' ? 'Хийгдэж буй ажил алга.' : 'Дууссан ажил алга.'}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => (
            <TaskCard key={t.id} task={t} />
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
        <span>
          Agent сүүлд {seen} ажилласан. GitHub хоцорч эсвэл зогссон байж магадгүй.{' '}
          <a href={RUN_NOW} target="_blank" rel="noreferrer" className="font-medium underline">
            Одоо эхлүүлэх
          </a>
        </span>
      </p>
    );
  if (!runner.claude)
    return (
      <p className={`${box} bg-amber-500/10 text-amber-200`} data-runner="nokey">
        Claude-ийн түлхүүр нэмэгдээгүй байна. Илгээсэн хуудас түлхүүр нэмэгдтэл хүлээнэ. Доорх зааврыг үзнэ үү.
      </p>
    );
  return (
    <p className={`${box} bg-green-500/10 text-green-200`} data-runner="on">
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" />
      Agent ажиллаж байна. Сүүлд {seen} шалгасан.
    </p>
  );
}

function TaskCard({task: t}: {task: AgentTask}) {
  const [error, setError] = useState('');
  const run = (f: () => Promise<unknown>) => void f().catch((e) => setError((e as Error).message));
  const btn = 'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium';
  return (
    <li className="rounded-2xl bg-neutral-900 p-4" data-task={t.id} data-status={t.status}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[t.status].tone}`}>{STATUS[t.status].label}</span>
        <span className="text-xs text-neutral-500">{when(t.at)}</span>
        {t.spent > 0 && (
          <span className="ml-auto text-xs tabular-nums text-neutral-500" title="Claude-ийн хэрэглээ, API-ийн үнээр">
            Хэрэглээ ≈ ${t.spent.toFixed(2)}
          </span>
        )}
      </div>
      <p className="mt-2 font-medium">
        {t.folder ? 'Сан · ' : ''}
        {t.title || (t.folder ? 'Хавтас' : 'Сэдэв')}
      </p>
      <p className="mt-0.5 text-sm text-neutral-400">
        {t.pages} хуудас
        {t.status === 'review' || t.status === 'done' ? ` · ${t.problems.length} бодлого хуваасан` : ''}
        {t.status === 'review' && t.added > 0 ? ` · ${t.added} хуудсыг нь нэмсэн` : ''}
      </p>
      {t.status === 'working' && (
        <p className="mt-2 flex items-center gap-2 text-sm text-blue-200">
          <Loader2 size={15} className="animate-spin" /> Уншиж байна. Хэдэн минут болно.
        </p>
      )}
      {t.status === 'new' && (
        <p className="mt-2 text-sm text-neutral-400">
          Agent эхлэхийг хүлээж байна. GitHub 5 минут тутам эхлүүлэх ёстой ч заримдаа удаан хоцордог. Удвал «Одоо эхлүүлэх» дараад GitHub дээр «Run
          workflow», дараа нь ногоон «Run workflow» дарна.
        </p>
      )}
      {t.status === 'failed' && t.error && <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{t.error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {t.status === 'review' && (
          <Link href={t.folder ? `/admin?tab=bank&folder=${encodeURIComponent(t.folder)}` : `/admin/topic/${t.topic}`} className={`${btn} bg-blue-500 font-semibold text-black hover:bg-blue-400`}>
            <ScanSearch size={15} /> {t.folder ? 'Хавтас руу очиж шалгах' : 'Сэдэв рүү очиж шалгах'}
          </Link>
        )}
        {t.status === 'new' && (
          <a href={RUN_NOW} target="_blank" rel="noreferrer" className={`${btn} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`} data-run-now>
            Одоо эхлүүлэх
          </a>
        )}
        {t.status === 'failed' && (
          <button type="button" onClick={() => run(() => retryTask(t.id))} className={`${btn} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}>
            Дахин оролдох
          </button>
        )}
        {(t.status === 'new' || t.status === 'review' || t.status === 'failed') && (
          <button type="button" onClick={() => confirm('Энэ хуудаснуудыг хаях уу?') && run(() => dropTask(t.id))} className={`${btn} text-neutral-300 hover:bg-neutral-800 hover:text-red-300`}>
            Хаях
          </button>
        )}
        {(t.status === 'done' || t.status === 'rejected') && (
          <button type="button" onClick={() => confirm('Жагсаалтаас устгах уу?') && run(() => removeTask(t.id))} className={`${btn} text-neutral-400 hover:bg-neutral-800 hover:text-red-300`}>
            <Trash2 size={15} /> Устгах
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-300">Болсонгүй: {error}</p>}
    </li>
  );
}

function SetupHelp({open}: {open: boolean}) {
  const code = 'rounded bg-neutral-800 px-1 text-neutral-200';
  return (
    <details open={open} className="group rounded-2xl bg-neutral-900 p-4 text-sm text-neutral-400 sm:p-5" data-setup>
      <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-neutral-100">
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" /> Тохируулах заавар
      </summary>
      <p className="mt-2">Agent нь GitHub дээр Claude-ээр ажилладаг. Таны Claude-ийн захиалгаар ажиллавал нэмж мөнгө төлөхгүй. Нэг удаа ингэж тохируулна:</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        <li>
          Claude Code суусан компьютерийн терминалд <code className={code}>claude setup-token</code> гэж бичнэ. Гарч ирсэн урт түлхүүрийг хуулна.
        </li>
        <li>
          GitHub дээр сайтын репо руу орно:{' '}
          <a href={`${REPO}/settings/secrets/actions`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
            Settings → Secrets and variables → Actions
          </a>
          . «New repository secret» дарж нэрийг нь <code className={code}>CLAUDE_CODE_OAUTH_TOKEN</code>, утгыг нь тэр түлхүүр болгоно.
        </li>
        <li>Хэдэн минутын дараа энд «Agent ажиллаж байна» гэж гарна.</li>
      </ol>
      <p className="mt-3">Нэг хуудас уншихад таны захиалгын хэрэглээнээс бага зэрэг хасагдана. Хуудас бүрийн хэрэглээ жагсаалтад гарна.</p>
      <p className="mt-2">
        Өөр арга нь{' '}
        <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
          console.anthropic.com
        </a>{' '}
        дээрх API түлхүүрийг <code className={code}>ANTHROPIC_API_KEY</code> нэрээр хадгалах. Тэр нь тусдаа төлбөртэй.
      </p>
    </details>
  );
}
