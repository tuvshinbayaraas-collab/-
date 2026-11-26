import {Check, Eye, EyeOff, FolderInput, FolderPlus, Images, Library, Pencil, Trash2, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {finishTask, loadPages, pageAdded, type AgentTask} from '../../lib/agents';
import {addFolder, addProblems, deleteFolder, deleteProblems, MAX_NAME, moveOldKeys, moveProblems, pathTo, renameFolder, setKey, setKind, setPublished, uploadBankImage, useBankFolders, useBankProblems, within, type BankFolder, type BankProblem} from '../../lib/bank';
import {agentPage} from '../../lib/pageSplit';
import {navigate, useLocation} from '../../lib/router';
import {problemNos} from '../../lib/topics';
import Loading from '../../components/Loading';
import {AgentSplitButton, AgentSplits, PAGE_FILES} from './AgentSplit';
import AnswerPicker from './AnswerPicker';
import {BankPath, BankProblemView, FolderButton} from './BankParts';
import {usePageFiles} from './PdfRange';
import ProblemsDialog from './ProblemsDialog';

const add = 'flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-700 py-4 text-sm font-semibold text-neutral-300 hover:border-blue-500 hover:text-blue-300';
const field = 'min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500';
const go = (fid: string) => navigate(fid ? `/admin?tab=bank&folder=${encodeURIComponent(fid)}` : '/admin?tab=bank');

/** Problems shown at once in a folder (a big one is shown in parts, its pictures loaded as they come). */
const PART = 30;

/**
 * «Бодлого»: the teacher's problem bank, in folders (folders in folders too). Problems come in from photographed pages
 * or PDFs (cut on the device, or by the agent, then checked), their right answers set here, moved between folders, and
 * taken into a topic from the topic editor («Сангаас нэмэх»). A folder the teacher publishes is open to students
 * («Бодлогын сан»), to solve.
 */
export default function BankTab() {
  const folders = useBankFolders();
  const problems = useBankProblems();
  const at = useLocation().query.get('folder') ?? '';
  // Right answers still kept in the problems (from before they had their own place, out of students' reach): moved.
  const old = problems ? Object.values(problems).flat().filter((p) => p.oldKey) : [];
  useEffect(() => {
    if (old.length) void moveOldKeys(old).catch(() => {});
    // Once per change in how many are left.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [old.length]);
  if (!folders || !problems) return <Loading small />;
  const folder = folders.find((f) => f.id === at);
  if (at && !folder)
    return (
      <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">
        Энэ хавтас олдсонгүй.{' '}
        <button type="button" onClick={() => go('')} className="text-blue-400 underline">
          Сан руу буцах
        </button>
      </p>
    );
  return (
    <div className="space-y-4" data-bank-tab>
      <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Library size={18} className="text-amber-300" /> Бодлогын сан
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Бодлогоо хавтсаар хадгална. Хавтас дотор хавтас үүсгэж болно. Бодлогыг номын хуудасны зураг эсвэл PDF-ээс оруулна. Сэдэв засахдаа «Сангаас нэмэх» дарж
          сэдэвт нэмнэ. Хавтсаа «Нийтлэх» бол сурагчид «Бодлогын сан»-аас харж, бодлогуудыг нь бодно. Нийтлээгүй хавтсыг зөвхөн та харна.
        </p>
      </section>
      <BankPath folders={folders} at={at} onGo={go} />
      {folder && <FolderHead folder={folder} folders={folders} problems={problems} />}
      {folder && <Publish folder={folder} folders={folders} problems={problems} />}
      <Folders at={at} folders={folders} problems={problems} />
      {folder && <FolderProblems folder={folder} folders={folders} list={problems[folder.id] ?? []} />}
    </div>
  );
}

function FolderHead({folder, folders, problems}: {folder: BankFolder; folders: BankFolder[]; problems: Record<string, BankProblem[]>}) {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const save = () => {
    if (!name?.trim()) return setName(null);
    renameFolder(folder.id, name).then(
      () => setName(null),
      (e) => setError((e as Error).message),
    );
  };
  const remove = () => {
    const inner = within(folders, folder.id);
    const count = [folder, ...inner].reduce((a, f) => a + (problems[f.id]?.length ?? 0), 0);
    const what = [inner.length ? `${inner.length} хавтас` : '', count ? `${count} бодлого` : ''].filter(Boolean).join(', ');
    if (!confirm(`«${folder.name}» хавтсыг${what ? ` доторх ${what}-той нь` : ''} устгах уу? Буцаах боломжгүй.`)) return;
    deleteFolder(folders, problems, folder.id).then(
      () => go(folder.parent),
      (e) => setError((e as Error).message),
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {name !== null ? (
        <>
          <input
            autoFocus
            aria-label="Хавтасны нэр"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className={field}
          />
          <button type="button" onClick={save} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400">
            <Check size={15} /> Хадгалах
          </button>
          <button type="button" onClick={() => setName(null)} className="rounded-full px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800">
            Болих
          </button>
        </>
      ) : (
        <>
          <h3 className="min-w-0 flex-1 truncate text-lg font-semibold">{folder.name}</h3>
          <button type="button" onClick={() => setName(folder.name)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
            <Pencil size={14} /> Нэр солих
          </button>
          <button type="button" onClick={remove} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-red-300">
            <Trash2 size={14} /> Устгах
          </button>
        </>
      )}
      {error && <p className="basis-full text-sm text-red-300">{error}</p>}
    </div>
  );
}

/** «Нийтлэх»: the folder open to students, or not; said when a folder above it is closed (then they can't reach it). */
function Publish({folder, folders, problems}: {folder: BankFolder; folders: BankFolder[]; problems: Record<string, BankProblem[]>}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const closedAbove = pathTo(folders, folder.id)
    .slice(0, -1)
    .filter((f) => !f.published);
  const toggle = () => {
    setBusy(true);
    setError('');
    setPublished(folder, problems[folder.id] ?? [], !folder.published).then(
      () => setBusy(false),
      (e) => {
        setBusy(false);
        setError((e as Error).message);
      },
    );
  };
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ${folder.published ? 'bg-green-500/10' : 'bg-neutral-900'}`} data-publish={folder.published ? 'on' : 'off'}>
      {folder.published ? <Eye size={18} className="shrink-0 text-green-300" /> : <EyeOff size={18} className="shrink-0 text-neutral-400" />}
      <p className="min-w-0 flex-1 text-sm">
        {folder.published ? (
          <>
            <span className="font-semibold text-green-200">Нийтэлсэн.</span> <span className="text-neutral-300">Сурагчид «Бодлогын сан»-аас энэ хавтасны бодлогуудыг харж, бодно.</span>
          </>
        ) : (
          <>
            <span className="font-semibold">Нийтлээгүй.</span> <span className="text-neutral-400">Зөвхөн та харна.</span>
          </>
        )}
        {folder.published && closedAbove.length > 0 && (
          <span className="mt-1 block text-amber-200">
            Дээрх «{closedAbove.map((f) => f.name).join(' › ')}» хавтас нийтлэгдээгүй тул сурагчид энэ хавтас руу орж чадахгүй. Тэр хавтсыг ч нийтэлнэ үү.
          </span>
        )}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={folder.published}
        aria-label="Сурагчдад нийтлэх"
        disabled={busy}
        onClick={toggle}
        className={`rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-60 ${folder.published ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-green-500 text-black hover:bg-green-400'}`}
      >
        {folder.published ? 'Нийтлэлээс авах' : 'Нийтлэх'}
      </button>
      {folder.published && (
        <button type="button" onClick={() => navigate(`/bank?folder=${encodeURIComponent(folder.id)}`)} className="rounded-full px-3 py-1.5 text-sm font-medium text-blue-300 hover:bg-neutral-800" data-preview>
          Сурагчаар харах
        </button>
      )}
      {error && <p className="basis-full text-sm text-red-300">Болсонгүй: {error}</p>}
    </div>
  );
}

function Folders({at, folders, problems}: {at: string; folders: BankFolder[]; problems: Record<string, BankProblem[]>}) {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const kids = folders.filter((f) => f.parent === at);
  const create = () => {
    if (!name?.trim()) return setName(null);
    if (pathTo(folders, at).length >= 6) return setError('Хавтас 6-аас илүү давхар байж болохгүй.');
    addFolder(name, at).then(
      () => setName(null),
      (e) => setError((e as Error).message),
    );
  };
  return (
    <section className="space-y-2">
      {(kids.length > 0 || !at) && <h3 className="text-sm font-semibold text-neutral-300">Хавтсууд</h3>}
      {!at && !kids.length && <p className="text-sm text-neutral-400">Одоогоор хавтас алга. Эхлээд хавтас үүсгэнэ үү. Жишээ нь «Алгебр» эсвэл «9-р анги».</p>}
      {kids.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {kids.map((f) => (
            <FolderButton key={f.id} f={f} problems={(problems[f.id] ?? []).length} folders={within(folders, f.id).length} onOpen={() => go(f.id)} shared />
          ))}
        </div>
      )}
      {name !== null ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            aria-label="Шинэ хавтасны нэр"
            placeholder="Хавтасны нэр"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className={field}
          />
          <button type="button" onClick={create} disabled={!name.trim()} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
            <Check size={15} /> Үүсгэх
          </button>
          <button type="button" onClick={() => setName(null)} className="rounded-full px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800">
            Болих
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setName('')} className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700">
          <FolderPlus size={15} /> {at ? 'Дотор нь хавтас үүсгэх' : 'Шинэ хавтас'}
        </button>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </section>
  );
}

function FolderProblems({folder, folders, list}: {folder: BankFolder; folders: BankFolder[]; list: BankProblem[]}) {
  const pagesRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const pageFiles = usePageFiles(setFiles);
  const [agentOpen, setAgentOpen] = useState<{task: AgentTask; pages: Promise<string[]>} | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(PART);
  const chosen = list.filter((p) => picked.has(p.id));
  const nos = problemNos(list);
  const run = (f: () => Promise<unknown>) => void f().catch((e) => setError((e as Error).message));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const added = (ps: Parameters<typeof addProblems>[1], keys: Record<string, string>) => run(() => addProblems(folder.id, ps, keys));
  const label = (f: BankFolder) =>
    pathTo(folders, f.id)
      .map((x) => x.name)
      .join(' › ');
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">Бодлого ({list.length})</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => pagesRef.current?.click()} disabled={!!pageFiles.busy} className={`${add} disabled:opacity-60`}>
          <Images size={18} /> {pageFiles.busy || 'Зургаас бодлогууд'}
        </button>
        <AgentSplitButton target={{folder: folder.id, title: folder.name}} className={add} />
      </div>
      <p className="text-xs text-neutral-500">
        Номын хуудасны зураг эсвэл PDF оруулна. «Зургаас бодлогууд» нь энэ төхөөрөмж дээр хуваана. «Agent-аар хуваах» нь Claude-аар уншуулна, хэдэн минутын дараа энд гарна.
      </p>
      <input
        ref={pagesRef}
        type="file"
        accept={PAGE_FILES}
        multiple
        hidden
        data-pages-input
        onChange={(e) => {
          pageFiles.choose([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      {pageFiles.sheet}
      {pageFiles.error && <p className="text-sm text-red-300">{pageFiles.error}</p>}
      <AgentSplits target={{folder: folder.id}} onOpen={(task) => setAgentOpen({task, pages: loadPages(task.id)})} />
      {files && <ProblemsDialog files={files} tid="bank" upload={uploadBankImage} onUploaded={() => {}} onAdd={added} onClose={() => setFiles(null)} />}
      {agentOpen && (
        <ProblemsDialog
          files={[]}
          agent={{
            pages: agentOpen.task.pages,
            start: Math.min(agentOpen.task.added, agentOpen.task.pages - 1),
            load: async (n) => {
              const pages = await agentOpen.pages;
              if (!pages[n]) throw new Error('Энэ хуудасны зураг олдсонгүй.');
              return agentPage(pages[n], agentOpen.task.problems.filter((p) => p.page === n));
            },
            onPage: (n) => void (n + 1 >= agentOpen.task.pages ? finishTask(agentOpen.task.id) : pageAdded(agentOpen.task.id, n + 1)).catch(() => {}),
          }}
          tid="bank"
          upload={uploadBankImage}
          onUploaded={() => {}}
          onAdd={added}
          onClose={() => setAgentOpen(null)}
        />
      )}

      {list.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => setPicked(picked.size === list.length ? new Set() : new Set(list.map((p) => p.id)))} className="rounded-full bg-neutral-800 px-3 py-1 hover:bg-neutral-700">
            {picked.size === list.length ? 'Сонголтыг арилгах' : 'Бүгдийг сонгох'}
          </button>
          {chosen.length > 0 && (
            <>
              <span className="text-neutral-400">{chosen.length} сонгосон</span>
              {moving ? (
                <select
                  autoFocus
                  aria-label="Аль хавтас руу зөөх вэ"
                  defaultValue=""
                  onChange={(e) => {
                    const to = e.target.value;
                    setMoving(false);
                    if (to)
                      run(async () => {
                        await moveProblems(chosen, to);
                        setPicked(new Set());
                      });
                  }}
                  onBlur={() => setMoving(false)}
                  className="max-w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm"
                >
                  <option value="">Хавтас сонгох…</option>
                  {folders
                    .filter((f) => f.id !== folder.id)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {label(f)}
                      </option>
                    ))}
                </select>
              ) : (
                <button type="button" onClick={() => setMoving(true)} disabled={folders.length < 2} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-neutral-200 hover:bg-neutral-800 disabled:opacity-50">
                  <FolderInput size={14} /> Зөөх
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  confirm(`Сонгосон ${chosen.length} бодлогыг устгах уу?`) &&
                  run(async () => {
                    await deleteProblems(chosen);
                    setPicked(new Set());
                  })
                }
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-red-300"
              >
                <Trash2 size={14} /> Устгах
              </button>
              <button type="button" onClick={() => setPicked(new Set())} aria-label="Сонголтыг арилгах" className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-800">
                <X size={14} />
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!list.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Энэ хавтсанд бодлого алга.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.slice(0, shown).map((p, i) => (
            <li key={p.id} className={`space-y-2 rounded-2xl border p-3 ${picked.has(p.id) ? 'border-blue-500 bg-blue-500/5' : 'border-transparent bg-neutral-900'}`} data-bank-problem={p.id}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-blue-500" aria-label={`${nos[i]}-р бодлогыг сонгох`} />
                <span className="font-semibold">{nos[i]}.</span>
              </label>
              <BankProblemView p={p} no={nos[i]} />
              <AnswerPicker p={{id: p.id, text: p.text, kind: p.kind, ...(p.choices ? {choices: p.choices} : {})}} answer={p.key ?? ''} onAnswer={(a) => run(() => setKey(p, a))} onKind={(k) => run(() => setKind(p, k))} />
            </li>
          ))}
        </ul>
      )}
      {list.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PART)} className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-medium text-blue-300 hover:bg-neutral-800" data-more>
          Цааш үзэх ({list.length - shown} бодлого үлдсэн)
        </button>
      )}
    </section>
  );
}
