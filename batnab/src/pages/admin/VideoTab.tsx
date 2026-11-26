import {Check, ChevronRight, Eye, EyeOff, Folder, FolderPlus, Link2, Pencil, Plus, Trash2, Video as VideoIcon, X} from 'lucide-react';
import {useState} from 'react';
import Loading from '../../components/Loading';
import {Rich} from '../../components/TopicParts';
import VideoEmbed, {canSeek, videoSource} from '../../components/VideoEmbed';
import {useBankImage} from '../../lib/bank';
import {useLive} from '../../lib/live';
import {navigate, useLocation} from '../../lib/router';
import {LETTER_LABELS} from '../../lib/topics';
import {
  addVideo,
  addVideoFolder,
  deleteVideo,
  deleteVideoFolder,
  linkProblems,
  MAX_MARKS,
  MAX_NOTE,
  MAX_PROBLEMS,
  MAX_TITLE,
  parseTime,
  publishVideoFolder,
  renameVideoFolder,
  saveVideo,
  timeLabel,
  unlinkProblem,
  useVideoFolders,
  useVideoKeys,
  useVideos,
  useWatched,
  type Video,
  type VideoDraft,
  type VideoFolder,
} from '../../lib/videos';
import BankPicker from './BankPicker';

const go = (fid: string) => navigate(fid ? `/admin?tab=video&folder=${encodeURIComponent(fid)}` : '/admin?tab=video');
const pill = 'flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50';
const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500';

/**
 * «Видео» in the teacher's dashboard: video lessons by link, in folders. A folder is published for students to see in
 * «Видео хичээл»; each video can have points to jump to and problems from the bank under it, and shows who has watched it.
 */
export default function VideoTab() {
  const at = useLocation().query.get('folder') ?? '';
  const folders = useVideoFolders();
  if (!folders) return <Loading small />;
  const folder = folders.find((f) => f.id === at);
  return (
    <div className="space-y-4" data-video-tab>
      <div className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <VideoIcon size={18} className="text-rose-300" /> Видео хичээл
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Видеогоо YouTube-д «Жагсаалтад харагдахгүй» (Unlisted) эсвэл Google Drive-д хуулаад холбоосыг нь энд тавина. Сайт видеог өөрөө хадгалахгүй, тиймээс сан дүүрэхгүй. Хавтсаа «Нийтлэх» бол сурагчид цэсний «Видео»-оос үзнэ.
          Сэдвийн хичээлд тавьсан видео тэнд өөрөө гарна.
        </p>
      </div>
      {at && !folder ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">
          Энэ хавтас олдсонгүй.{' '}
          <button type="button" onClick={() => go('')} className="text-blue-400 underline">
            Буцах
          </button>
        </p>
      ) : folder ? (
        <FolderView folder={folder} />
      ) : (
        <Folders folders={folders} />
      )}
    </div>
  );
}

function Folders({folders}: {folders: VideoFolder[]}) {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const create = () => {
    if (!name?.trim()) return setName(null);
    addVideoFolder(name).then(
      (id) => {
        setName(null);
        go(id);
      },
      (e) => setError((e as Error).message),
    );
  };
  return (
    <section className="space-y-3">
      {folders.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {folders.map((f) => (
            <button key={f.id} type="button" onClick={() => go(f.id)} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-4 text-left hover:bg-neutral-800" data-video-folder={f.id}>
              <Folder size={20} className="shrink-0 text-rose-300" />
              <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
              {f.published && (
                <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-300">
                  <Eye size={12} /> Нийтэлсэн
                </span>
              )}
              <ChevronRight size={16} className="shrink-0 text-neutral-500" />
            </button>
          ))}
        </div>
      )}
      {!folders.length && <p className="text-sm text-neutral-400">Одоогоор хавтас алга. Эхлээд хавтас үүсгэнэ үү. Жишээ нь «Алгебр» эсвэл «9-р анги».</p>}
      {name === null ? (
        <button type="button" onClick={() => setName('')} className={pill}>
          <FolderPlus size={16} /> Хавтас үүсгэх
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Хавтасны нэр" aria-label="Хавтасны нэр" className={`${field} max-w-xs`} />
          <button type="button" onClick={create} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400">
            Үүсгэх
          </button>
          <button type="button" onClick={() => setName(null)} className={pill}>
            Болих
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-300">Болсонгүй: {error}</p>}
    </section>
  );
}

function FolderView({folder}: {folder: VideoFolder}) {
  const videos = useVideos(folder.id);
  const keys = useVideoKeys(folder.id);
  const watched = useWatched(null);
  const users = useLive('users', (v) => (v ?? {}) as Record<string, {name?: string; username?: string; class?: string; disabled?: boolean}>);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const run = (p: Promise<unknown>) => p.catch((e) => setError((e as Error).message));
  // The students (with a class, not turned off): who has watched each video.
  const students = Object.entries(users ?? {}).filter(([, u]) => u.class && !u.disabled);
  return (
    <section className="space-y-4">
      <nav aria-label="Байршил" className="flex items-center gap-1 text-sm">
        <button type="button" onClick={() => go('')} className="text-blue-400 hover:underline">
          Видео
        </button>
        <ChevronRight size={14} className="text-neutral-500" />
        <span className="font-semibold">{folder.name}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        {renaming === null ? (
          <h2 className="mr-auto text-xl font-semibold">{folder.name}</h2>
        ) : (
          <div className="mr-auto flex flex-wrap gap-2">
            <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value.slice(0, 80))} aria-label="Хавтасны нэр" className={`${field} max-w-xs`} />
            <button type="button" onClick={() => renaming.trim() && void run(renameVideoFolder(folder, renaming).then(() => setRenaming(null)))} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black">
              Хадгалах
            </button>
          </div>
        )}
        <button type="button" onClick={() => setRenaming(renaming === null ? folder.name : null)} className={pill}>
          <Pencil size={15} /> {renaming === null ? 'Нэр солих' : 'Болих'}
        </button>
        <button type="button" onClick={() => confirm(`«${folder.name}» хавтсыг доторх бүх видеотой нь устгах уу?`) && void run(deleteVideoFolder(folder).then(() => go('')))} className={pill}>
          <Trash2 size={15} /> Устгах
        </button>
      </div>
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ${folder.published ? 'bg-green-500/10' : 'bg-neutral-900'}`} data-video-publish={folder.published ? 'on' : 'off'}>
        {folder.published ? <Eye size={18} className="shrink-0 text-green-300" /> : <EyeOff size={18} className="shrink-0 text-neutral-400" />}
        <p className="min-w-0 flex-1 text-sm">{folder.published ? <span className="font-semibold text-green-200">Нийтэлсэн. Сурагчид «Видео»-оос үзнэ.</span> : <span><b>Нийтлээгүй.</b> <span className="text-neutral-400">Зөвхөн та харна.</span></span>}</p>
        <button
          type="button"
          role="switch"
          aria-checked={folder.published}
          aria-label="Сурагчдад нийтлэх"
          onClick={() => void run(publishVideoFolder(folder, !folder.published))}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${folder.published ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-green-500 text-black hover:bg-green-400'}`}
        >
          {folder.published ? 'Нийтлэлээс авах' : 'Нийтлэх'}
        </button>
        {folder.published && (
          <button type="button" onClick={() => navigate(`/videos?folder=${encodeURIComponent(folder.id)}`)} className="rounded-full px-3 py-1.5 text-sm font-medium text-blue-300 hover:bg-neutral-800">
            Сурагчаар харах
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-300">Болсонгүй: {error}</p>}
      {adding ? (
        <VideoForm
          onSave={(d) => addVideo(folder.id, d).then(() => setAdding(false))}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-700 py-4 text-sm font-semibold text-neutral-300 hover:border-blue-500 hover:text-blue-300">
          <Plus size={18} /> Видео нэмэх
        </button>
      )}
      {!videos ? (
        <Loading small />
      ) : !videos.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Энэ хавтсанд видео алга.</p>
      ) : (
        <ul className="space-y-3">
          {videos.map((v) => (
            <VideoAdmin key={v.id} v={v} keys={keys?.[v.id] ?? {}} watchers={students.filter(([uid]) => watched?.[uid] && (watched[uid] as Record<string, unknown>)[v.id]).map(([, u]) => u.name || u.username || '')} total={students.length} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** A video's link, title, note and points, to add or change. */
function VideoForm({v, onSave, onCancel}: {v?: Video; onSave: (d: VideoDraft) => Promise<unknown>; onCancel: () => void}) {
  const [url, setUrl] = useState(v?.url ?? '');
  const [title, setTitle] = useState(v?.title ?? '');
  const [note, setNote] = useState(v?.note ?? '');
  const [marks, setMarks] = useState<{time: string; label: string}[]>(v?.marks.map((m) => ({time: timeLabel(m.t), label: m.label})) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const source = url.trim() ? videoSource(url.trim()) : null;
  const badTimes = marks.filter((m) => m.label.trim() && parseTime(m.time) === null);
  const save = async () => {
    if (!source || source.kind === 'link') return setError('YouTube, Google Drive эсвэл Vimeo-гийн видеоны холбоос тавина уу.');
    if (!title.trim()) return setError('Гарчиг бичнэ үү.');
    if (badTimes.length) return setError(`Цагийг «3:20» гэж бичнэ үү (${badTimes.map((m) => m.time || 'хоосон').join(', ')}).`);
    setBusy(true);
    setError('');
    try {
      await onSave({url, title, note, marks: marks.filter((m) => m.label.trim()).map((m) => ({t: parseTime(m.time)!, label: m.label}))});
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl bg-neutral-900 p-4" data-video-form>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Видеоны холбоос</span>
        <input value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} placeholder="https://youtu.be/… эсвэл Google Drive-ийн холбоос" className={field} inputMode="url" />
        {url.trim() && (!source || source.kind === 'link') && <span className="mt-1 block text-xs text-amber-200">Энэ YouTube, Google Drive, Vimeo-гийн видео биш байна.</span>}
        {source?.kind === 'drive' && <span className="mt-1 block text-xs text-neutral-400">Drive дээр файлаа «Холбоостой хэн бүхэн үзэх» болгоно уу. Drive-ийн видеог цэг дээр нь үсрүүлж чадахгүй.</span>}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Гарчиг</span>
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))} placeholder="Квадрат тэгшитгэл бодох" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Тайлбар (заавал биш)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))} rows={2} placeholder="Юу үзэх, юуг анхаарах вэ" className={field} />
      </label>
      <div className="space-y-2 text-sm">
        <p className="font-medium">Цагийн тэмдэг (заавал биш)</p>
        <p className="text-xs text-neutral-400">Сурагч дарахад видео тэр хэсгээс эхэлнэ. Жишээ нь «3:20 — Дискриминант».</p>
        {marks.map((m, i) => (
          <div key={i} className="flex gap-2">
            <input value={m.time} onChange={(e) => setMarks((ms) => ms.map((x, j) => (j === i ? {...x, time: e.target.value.slice(0, 8)} : x)))} placeholder="3:20" aria-label="Цаг" className={`${field} w-20 shrink-0 ${m.label.trim() && parseTime(m.time) === null ? 'border-amber-500' : ''}`} />
            <input value={m.label} onChange={(e) => setMarks((ms) => ms.map((x, j) => (j === i ? {...x, label: e.target.value.slice(0, 80)} : x)))} placeholder="Юу ярьж байна" aria-label="Тэмдгийн нэр" className={field} />
            <button type="button" onClick={() => setMarks((ms) => ms.filter((_, j) => j !== i))} aria-label="Тэмдгийг хасах" className="shrink-0 rounded-full p-2 text-neutral-400 hover:bg-neutral-800">
              <X size={16} />
            </button>
          </div>
        ))}
        {marks.length < MAX_MARKS && (
          <button type="button" onClick={() => setMarks((ms) => [...ms, {time: '', label: ''}])} className={pill}>
            <Plus size={15} /> Тэмдэг нэмэх
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={pill}>
          Болих
        </button>
        <button type="button" onClick={() => void save()} disabled={busy} className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
          {busy ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </div>
    </div>
  );
}

function VideoAdmin({v, keys, watchers, total}: {v: Video; keys: Record<string, string>; watchers: string[]; total: number}) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [who, setWho] = useState(false);
  const [error, setError] = useState('');
  const run = (p: Promise<unknown>) => p.catch((e) => setError((e as Error).message));
  if (editing) return <li><VideoForm v={v} onSave={(d) => saveVideo(v, d).then(() => setEditing(false))} onCancel={() => setEditing(false)} /></li>;
  return (
    <li className="space-y-3 rounded-2xl bg-neutral-900 p-4" data-video={v.id}>
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="mr-auto min-w-0 text-lg font-semibold [overflow-wrap:anywhere]">{v.title}</h3>
        <button type="button" onClick={() => setEditing(true)} className={pill}>
          <Pencil size={15} /> Засах
        </button>
        <button type="button" onClick={() => confirm(`«${v.title}» видеог устгах уу?`) && void run(deleteVideo(v))} className={pill}>
          <Trash2 size={15} /> Устгах
        </button>
      </div>
      <div className="max-w-xl">
        <VideoEmbed link={v.url} title={v.title} />
      </div>
      {v.note && <p className="whitespace-pre-line text-sm text-neutral-300">{v.note}</p>}
      {v.marks.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 text-sm">
          {v.marks.map((m, i) => (
            <li key={i} className="rounded-full bg-neutral-800 px-3 py-1">
              <span className="font-semibold tabular-nums text-rose-300">{timeLabel(m.t)}</span> {m.label}
            </li>
          ))}
          {!canSeek(videoSource(v.url)) && <li className="px-1 py-1 text-xs text-neutral-500">(Drive-ийн видеог цэг дээр нь үсрүүлэхгүй)</li>}
        </ul>
      )}
      <div>
        <button type="button" onClick={() => setWho(!who)} aria-expanded={who} className="flex items-center gap-1.5 text-sm text-neutral-300 hover:underline" data-watched-count>
          <Check size={15} className="text-green-400" /> {watchers.length}/{total} сурагч үзсэн
        </button>
        {who && <p className="mt-1 text-sm text-neutral-400">{watchers.length ? watchers.sort((a, b) => a.localeCompare(b, 'mn')).join(', ') : 'Одоогоор хэн ч үзсэн гэж тэмдэглээгүй.'}</p>}
      </div>
      <div className="space-y-2 border-t border-neutral-800 pt-3">
        <p className="text-sm font-medium">Үзсэний дараа бодох бодлого ({v.problems.length})</p>
        {v.problems.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {v.problems.map((p, i) => (
              <LinkedProblem key={p.id} no={i + 1} p={p} answer={keys[p.id]} onRemove={() => void run(unlinkProblem(v, p.id))} />
            ))}
          </ul>
        )}
        {v.problems.length < MAX_PROBLEMS && (
          <button type="button" onClick={() => setPicking(true)} className={pill}>
            <Link2 size={15} /> Сангаас бодлого холбох
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-300">Болсонгүй: {error}</p>}
      {picking && <BankPicker sub="Видеоны доор бодох бодлогуудаа сонгоно. Зураг, зөв хариулттай нь хуулагдана." onPick={(ps) => linkProblems(v, ps)} onClose={() => setPicking(false)} />}
    </li>
  );
}

function LinkedProblem({no, p, answer, onRemove}: {no: number; p: Video['problems'][number]; answer?: string; onRemove: () => void}) {
  const url = useBankImage(p.img);
  const shown = answer ? (p.kind === 'choice' ? (LETTER_LABELS[answer as keyof typeof LETTER_LABELS] ?? answer) : answer) : null;
  return (
    <li className="space-y-1 rounded-xl bg-neutral-800/60 p-2 text-sm" data-video-problem={p.id}>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{no}.</span>
        <span className="mr-auto text-xs text-neutral-400">{shown ? `Зөв хариулт: ${shown}` : 'Зөв хариултгүй'}</span>
        <button type="button" onClick={onRemove} aria-label={`${no}-р бодлогыг хасах`} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-700">
          <X size={15} />
        </button>
      </div>
      {p.img ? url ? <img src={url} alt={`${no}-р бодлогын зураг`} className="max-h-32 w-full rounded bg-white object-contain" /> : <div className="h-16 animate-pulse rounded bg-neutral-800" /> : <Rich text={p.text} className="line-clamp-3 text-neutral-300" />}
    </li>
  );
}
