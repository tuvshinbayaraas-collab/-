import {ArrowDown, ArrowLeft, ArrowUp, BarChart3, Check, ChevronsDownUp, ChevronsUpDown, ChevronUp, ClipboardCheck, Copy, Eye, ImagePlus, Images, ListChecks, Pencil, Plus, RotateCcw, ScanText, School, Trash2, Type, X} from 'lucide-react';
import {useEffect, useRef, useState, type DragEvent, type ReactNode} from 'react';
import Switch, {SavedNote, useSavedNote} from '../../components/Switch';
import {Rich, TopicPicture} from '../../components/TopicParts';
import {useClasses} from '../../lib/classes';
import {chunks} from '../../lib/ocr';
import {imageFile} from '../../lib/photo';
import {Link, navigate} from '../../lib/router';
import {
  copyTopic,
  deleteTopic,
  imagesOf,
  LETTER_CODES,
  LETTER_LABELS,
  newId,
  problemNo,
  resetProgress,
  saveTopic,
  uploadTopicImage,
  useAllMarks,
  useAllProgress,
  useTopicImage,
  useTopicKeys,
  useTopics,
  verdict,
  type Block,
  type Letter,
  type Problem,
  type Topic,
} from '../../lib/topics';
import type {AdminData} from './data';
import AnswerPicker from './AnswerPicker';
import BulkAnswers from './BulkAnswers';
import {field, MathArea} from './MathField';
import OcrDialog, {type OcrAction} from './OcrDialog';
import ProblemsDialog from './ProblemsDialog';
import TopicCheck, {waitingIn} from './TopicCheck';

const small = 'flex items-center gap-1.5 rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50';
const addButton = 'flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-700 py-4 text-sm font-semibold text-neutral-300 hover:border-blue-500 hover:text-blue-300';
const icon = 'rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-25';

/** /admin/topic/{id}: write the lesson and the problems, then open the topic to students; see how they did. */
export default function TopicEditor({id, data}: {id: string; data: AdminData}) {
  const topics = useTopics();
  const keys = useTopicKeys(id);
  if (!topics || !keys) return <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>;
  const topic = topics.find((t) => t.id === id);
  if (!topic)
    return (
      <p className="py-10 text-center text-neutral-400">
        Сэдэв олдсонгүй.{' '}
        <Link href="/admin?tab=topics" className="text-blue-400 hover:underline">
          Сэдвүүд
        </Link>
      </p>
    );
  return <Editor key={id} topic={topic} keys={keys} data={data} />;
}

const snapshot = (t: Topic, k: Record<string, string>) =>
  JSON.stringify([t.title.trim(), t.intro?.trim() ?? '', t.published, Object.keys(t.classes ?? {}).sort(), t.lesson, t.problems, Object.entries(k).filter(([, v]) => v).sort()]);

function Editor({topic, keys, data}: {topic: Topic; keys: Record<string, string>; data: AdminData}) {
  const topics = useTopics();
  const progress = useAllProgress();
  const marks = useAllMarks();
  const [draft, setDraft] = useState<Topic>(() => structuredClone(topic));
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({...keys}));
  const [saved, setSaved] = useState(() => snapshot(topic, keys));
  const [mode, setMode] = useState<'edit' | 'check' | 'results'>(() => (new URLSearchParams(location.search).has('check') ? 'check' : 'edit'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, flash] = useSavedNote();
  // "Зургаас бодлогууд": the photos of book pages being cut into problems; "Хариултуудыг нэг дор".
  const [pages, setPages] = useState<File[] | null>(null);
  const [bulk, setBulk] = useState(false);
  const pagesRef = useRef<HTMLInputElement>(null);
  // Problems open for editing; the rest show as their picture and the А–Д row. Empty ones start open.
  const [opened, setOpened] = useState(() => new Set(topic.problems.filter((p) => !p.text && !p.img).map((p) => p.id)));
  // Pictures the topic used when opened, and the ones added since: whatever of these the topic no longer uses is
  // deleted when it's saved.
  const known = useRef(imagesOf(topic));
  const now = snapshot(draft, answers);
  const dirty = now !== saved;
  // A save that failed isn't tried again on its own until something changes.
  const failed = useRef('');

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (f: (t: Topic) => Topic) => setDraft((t) => f(structuredClone(t)));
  const uploaded = (iid: string) => known.current.add(iid);
  // Deleted: nothing is saved after that (it would bring the topic back without its pictures).
  const deleted = useRef(false);
  /** Saves the draft; whether it went. */
  const save = async (manual = false) => {
    if (deleted.current) return false;
    setBusy(true);
    setError('');
    const at = snapshot(draft, answers);
    try {
      const used = imagesOf(draft);
      const gone = [...known.current].filter((i) => !used.has(i));
      await saveTopic(draft, answers, gone);
      // Not the pictures added while it saved: they are still to be cleaned up if left out.
      for (const i of gone) known.current.delete(i);
      setSaved(at);
      if (manual) flash();
      return true;
    } catch (e) {
      failed.current = at;
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  // Changes save themselves a moment after the last one ("Хадгалах" saves at once).
  useEffect(() => {
    if (!dirty || busy || !draft.title.trim() || failed.current === now) return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
    // `save` is this render's, with the draft just changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, dirty, busy]);
  // Left another way than the editor's own buttons (a tab of the teacher's page, the browser's Back) within that
  // moment: the last change is saved on the way out.
  const flush = useRef<(() => void) | null>(null);
  flush.current = dirty && draft.title.trim() && failed.current !== now ? () => void save() : null;
  useEffect(() => () => flush.current?.(), []);
  const copy = async () => {
    if (dirty) await save();
    try {
      const all = topics ?? [];
      navigate(`/admin/topic/${await copyTopic(draft, answers, Math.max(Date.now(), ...all.map((t) => t.order + 1)))}`);
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
    }
  };
  const remove = async () => {
    if (!confirm(`«${draft.title}» сэдвийг хичээл, бодлого, зураг, сурагчдын хариултын хамт устгах уу?`)) return;
    deleted.current = true;
    const ok = await deleteTopic(draft.id).then(
      () => true,
      (e) => alert(`Алдаа: ${(e as Error).message}`),
    );
    if (!ok) deleted.current = false;
    else navigate('/admin?tab=topics');
  };
  const leave = async (href: string) => {
    if (dirty && !((draft.title.trim() && (await save())) || confirm('Өөрчлөлтийг хадгалж чадсангүй, алга болно. Гарах уу?'))) return;
    navigate(href);
  };
  const open = draft.problems.filter((p) => !answers[p.id]).length;
  const waiting = progress && marks ? waitingIn(draft, data.students, progress, marks, answers) : 0;
  const toggle = (id: string) =>
    setOpened((o) => {
      const n = new Set(o);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const allOpen = draft.problems.length > 0 && draft.problems.every((p) => opened.has(p.id));

  return (
    <div className="space-y-5 pb-24">
      <button onClick={() => leave('/admin?tab=topics')} className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={16} /> Сэдвүүд
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-neutral-900 p-1" role="tablist">
          {(
            [
              ['edit', 'Засах', Pencil],
              ['check', 'Шалгах', ClipboardCheck],
              ['results', 'Үр дүн', BarChart3],
            ] as const
          ).map(([m, label, I]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium sm:px-4 ${mode === m ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}>
              <I size={15} /> {label}
              {m === 'check' && waiting > 0 && <span className="rounded-full bg-violet-500 px-1.5 text-[11px] font-bold leading-4 text-black">{waiting}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => leave(`/topics/${draft.id}`)} className={`${small} ml-auto`}>
          <Eye size={15} /> Сурагчаар харах
        </button>
      </div>

      {mode === 'results' ? (
        <Results topic={draft} answers={answers} data={data} />
      ) : mode === 'check' ? (
        progress && marks ? (
          <TopicCheck topic={draft} students={data.students} progress={progress} marks={marks} keys={answers} onKey={(pid, k) => setAnswers((x) => ({...x, [pid]: k}))} />
        ) : (
          <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>
        )
      ) : (
        <>
          <Card>
            <input
              value={draft.title}
              maxLength={80}
              autoFocus={topic.title === 'Шинэ сэдэв' && !topic.problems.length && !topic.lesson.length}
              onFocus={(e) => draft.title === 'Шинэ сэдэв' && e.target.select()}
              onChange={(e) => change((t) => ({...t, title: e.target.value}))}
              placeholder="Сэдвийн нэр, жишээ нь: Логарифм"
              aria-label="Сэдвийн нэр"
              className="w-full bg-transparent text-xl font-bold outline-none placeholder:text-neutral-600 sm:text-2xl"
            />
            <textarea
              value={draft.intro ?? ''}
              maxLength={300}
              rows={2}
              onChange={(e) => change((t) => ({...t, intro: e.target.value}))}
              placeholder="Товч тайлбар (заавал биш): юу сурах вэ"
              aria-label="Товч тайлбар"
              className={`${field} mt-3 resize-y text-sm`}
            />
            <ClassPicker value={draft.classes} onChange={(classes) => change((t) => ({...t, classes}))} />
            <div className="-mx-5 mt-3 border-t border-neutral-800">
              <Switch on={draft.published} onChange={(on) => change((t) => ({...t, published: on}))} className="px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Сурагчдад нээх</span>
                  <span className="block text-sm text-neutral-400">{draft.published ? 'Сурагчид «Сэдвүүд»-ээс харж, бодлогоо бодно.' : 'Ноорог: зөвхөн та харна. Бэлэн болмогц асаана.'}</span>
                </span>
              </Switch>
            </div>
          </Card>

          <Lesson topic={draft} onChange={(lesson) => change((t) => ({...t, lesson}))} onAdd={(bs) => change((t) => ({...t, lesson: [...t.lesson, ...bs]}))} onUploaded={uploaded} />

          <section className="space-y-3">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold">
              Бодлого ({draft.problems.length})
              {open > 0 && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-200">{open} нь багш шалгана</span>}
              <span className="ml-auto flex flex-wrap gap-2">
                {draft.problems.length > 1 && (
                  <button onClick={() => setBulk(true)} className={`${small} font-normal`}>
                    <ListChecks size={15} /> Хариултуудыг нэг дор
                  </button>
                )}
                {draft.problems.length > 1 && (
                  <button onClick={() => setOpened(allOpen ? new Set() : new Set(draft.problems.map((p) => p.id)))} className={`${small} font-normal`}>
                    {allOpen ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />} {allOpen ? 'Бүгдийг хураах' : 'Бүгдийг дэлгэх'}
                  </button>
                )}
              </span>
            </h2>
            {draft.problems.length > 0 && <p className="-mt-1 text-xs text-neutral-500">Зөв хариултын үсэг дээр дарна (дахин дарвал арилна). Хариултгүй бодлогын сурагчдын хариулт «Шалгах»-д ирж, та зөв, бурууг нь тэмдэглэнэ.</p>}
            {draft.problems.map((p, i) => (
              <ProblemEditor
                key={p.id}
                tid={draft.id}
                p={p}
                num={i + 1}
                count={draft.problems.length}
                open={opened.has(p.id)}
                onToggle={() => toggle(p.id)}
                answer={answers[p.id] ?? ''}
                onUploaded={uploaded}
                onChange={(f) => change((t) => ({...t, problems: t.problems.map((x) => (x.id === p.id ? f(x) : x))}))}
                onAnswer={(a) => setAnswers((k) => ({...k, [p.id]: a}))}
                onMove={(to) => change((t) => ({...t, problems: moveTo(t.problems, i, to)}))}
                onRemove={() => confirm(`${problemNo(p, i)}-р бодлогыг устгах уу?`) && change((t) => ({...t, problems: t.problems.filter((x) => x.id !== p.id)}))}
                onCopy={() => {
                  const id = newId();
                  change((t) => ({...t, problems: [...t.problems.slice(0, i + 1), {...structuredClone(p), id}, ...t.problems.slice(i + 1)]}));
                  if (answers[p.id]) setAnswers((k) => ({...k, [id]: answers[p.id]}));
                }}
              />
            ))}
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => {
                  const id = newId();
                  change((t) => ({...t, problems: [...t.problems, {id, text: '', kind: 'choice'}]}));
                  setOpened((o) => new Set(o).add(id));
                }}
                className={addButton}
              >
                <Plus size={18} /> Бодлого нэмэх
              </button>
              <button onClick={() => pagesRef.current?.click()} className={addButton}>
                <Images size={18} /> Зургаас бодлогууд
              </button>
            </div>
            <p className="text-xs text-neutral-500">«Зургаас бодлогууд»: номын хуудасны зургийг (хэд хэдийг ч болно) оруулбал дугаартай бодлого бүрийг тусад нь зураг болгон тасдаж нэмнэ; хариултыг нь тэнд нь сонгож болно.</p>
            <input
              ref={pagesRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const fs = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/'));
                if (fs.length) setPages(fs);
                e.target.value = '';
              }}
            />
            {pages && (
              <ProblemsDialog
                files={pages}
                tid={draft.id}
                onUploaded={uploaded}
                onAdd={(ps, ks) => {
                  change((t) => ({...t, problems: [...t.problems, ...ps]}));
                  setAnswers((k) => ({...k, ...ks}));
                }}
                onClose={() => setPages(null)}
              />
            )}
            {bulk && <BulkAnswers problems={draft.problems} answers={answers} onApply={(found) => setAnswers((k) => ({...k, ...found}))} onClose={() => setBulk(false)} />}
          </section>

          <div className="flex flex-wrap gap-4">
            <button onClick={copy} className="flex items-center gap-1.5 text-sm text-neutral-300 hover:underline">
              <Copy size={15} /> Сэдвийг хуулбарлах (өөр ангид)
            </button>
            <button onClick={remove} className="flex items-center gap-1.5 text-sm text-red-400 hover:underline">
              <Trash2 size={15} /> Сэдвийг устгах
            </button>
          </div>
        </>
      )}

      {/* Over the page only while there's something to save; saved, it keeps out of the way. */}
      {dirty || busy || error ? (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/95 px-4 py-3 shadow-xl backdrop-blur">
          <span className={`min-w-0 flex-1 text-sm ${error ? 'text-red-400' : 'text-amber-300'}`}>
            {error ? `Хадгалж чадсангүй: ${error}` : busy ? 'Хадгалж байна…' : draft.title.trim() ? 'Удахгүй өөрөө хадгална…' : 'Сэдвийн нэрийг бичнэ үү'}
          </span>
          <button onClick={() => save(true)} disabled={busy || !dirty || !draft.title.trim()} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
            <Check size={16} /> {busy ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-500">
          <Check size={13} /> Бүх өөрчлөлт хадгалагдсан
        </p>
      )}
      <SavedNote show={note} />
    </div>
  );
}

/** The list with the item at `from` moved to `to` (0-based). */
const moveTo = <T,>(xs: T[], from: number, to: number) => {
  if (to < 0 || to >= xs.length || to === from) return xs;
  const out = [...xs];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
};

const swap = <T,>(xs: T[], i: number, j: number) => {
  if (j < 0 || j >= xs.length) return xs;
  const out = [...xs];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

const Card = ({children}: {children: ReactNode}) => <section className="rounded-2xl bg-neutral-900 p-5">{children}</section>;

/** Which classes see the topic: every class, or the ones ticked. */
function ClassPicker({value, onChange}: {value?: Record<string, true>; onChange: (v?: Record<string, true>) => void}) {
  const classes = useClasses() ?? [];
  if (!classes.length) return null;
  const ids = Object.keys(value ?? {});
  const chip = (on: boolean) => `flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${on ? 'bg-blue-500 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-neutral-400">
        <School size={15} /> Анги:
      </span>
      <button type="button" onClick={() => onChange(undefined)} className={chip(!ids.length)}>
        Бүх анги
      </button>
      {classes.map((c) => {
        const on = ids.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              const next = on ? ids.filter((x) => x !== c.id) : [...ids, c.id];
              onChange(next.length ? Object.fromEntries(next.map((x) => [x, true as const])) : undefined);
            }}
            className={chip(on)}
          >
            {on && <Check size={13} />} {c.name}
          </button>
        );
      })}
    </div>
  );
}

/** The lesson: paragraphs of text (with $math$) and pictures, in order. */
function Lesson({topic, onChange, onAdd, onUploaded}: {topic: Topic; onChange: (b: Block[]) => void; onAdd: (b: Block[]) => void; onUploaded: (iid: string) => void}) {
  const blocks = topic.lesson;
  const set = (i: number, b: Block) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  // "Зургаас бичвэр": a new picture to read, or the lesson picture at this place.
  const [reading, setReading] = useState<File | number | null>(null);
  const paragraphs = (text: string): Block[] => chunks(text, LESSON_MAX).map((t) => ({t: 'text', text: t}));
  const addImage = async (file: File | null) => {
    if (!file) return;
    setAdding(true);
    setError('');
    try {
      const iid = await uploadTopicImage(topic.id, file);
      onUploaded(iid);
      // At the end of the lesson as it is now (it may have changed while the picture went up).
      onAdd([{t: 'img', img: iid}]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const readRef = useRef<HTMLInputElement>(null);
  const block = typeof reading === 'number' ? blocks[reading] : null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Хичээл</h2>
        <p className="text-sm text-neutral-400">Сэдвийн тайлбар, жишээ, томьёо. Томьёог $…$ дотор бичнэ: $\log_2 8 = 3$, $x^2$, $\frac{"{1}{2}"}$.</p>
      </div>
      {blocks.map((b, i) => (
        <div key={i} className="rounded-2xl bg-neutral-900 p-4">
          <div className="mb-2 flex items-center gap-1 text-xs text-neutral-500">
            {b.t === 'text' ? <Type size={14} /> : <ImagePlus size={14} />} {b.t === 'text' ? 'Бичвэр' : 'Зураг'}
            <span className="ml-auto flex">
              <button onClick={() => onChange(swap(blocks, i, i - 1))} disabled={i === 0} aria-label="Дээш" className={icon}>
                <ArrowUp size={15} />
              </button>
              <button onClick={() => onChange(swap(blocks, i, i + 1))} disabled={i === blocks.length - 1} aria-label="Доош" className={icon}>
                <ArrowDown size={15} />
              </button>
              <button onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label="Устгах" className={icon}>
                <Trash2 size={15} />
              </button>
            </span>
          </div>
          {b.t === 'text' ? (
            <MathArea value={b.text} onChange={(text) => set(i, {t: 'text', text})} rows={4} max={LESSON_MAX} placeholder="Хичээлийн бичвэр…" />
          ) : (
            <>
              <TopicPicture tid={topic.id} iid={b.img} className="w-full" />
              <button onClick={() => setReading(i)} className={`${small} mt-2`}>
                <ScanText size={15} /> Зургаас бичвэр гаргах
              </button>
            </>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onChange([...blocks, {t: 'text', text: ''}])} className={small}>
          <Type size={15} /> Бичвэр нэмэх
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={adding} className={small}>
          <ImagePlus size={15} /> {adding ? 'Зураг хуулж байна…' : 'Зураг нэмэх'}
        </button>
        <button onClick={() => readRef.current?.click()} disabled={adding} className={small} title="Номын хуудас, бодолтын зургийн бичвэрийг уншиж бичвэр болгоно">
          <ScanText size={15} /> Зургаас бичвэр
        </button>
        <input
          ref={readRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setReading(f);
            e.target.value = '';
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            addImage(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {reading instanceof File && (
        <OcrDialog
          image={reading}
          onClose={() => setReading(null)}
          actions={[
            {
              label: 'Зурагтай нь нэмэх',
              run: async (text) => {
                const iid = await uploadTopicImage(topic.id, reading);
                onUploaded(iid);
                onAdd([{t: 'img', img: iid}, ...paragraphs(text)]);
              },
            },
            {label: 'Бичвэр болгож нэмэх', primary: true, run: (text) => onAdd(paragraphs(text))},
          ]}
        />
      )}
      {typeof reading === 'number' && block?.t === 'img' && (
        <StoredOcr
          tid={topic.id}
          iid={block.img}
          onClose={() => setReading(null)}
          actions={[
            {label: 'Зургийг бичвэрээр солих', run: (text) => onChange([...blocks.slice(0, reading), ...paragraphs(text), ...blocks.slice(reading + 1)])},
            {label: 'Зургийн доор нэмэх', primary: true, run: (text) => onChange([...blocks.slice(0, reading + 1), ...paragraphs(text), ...blocks.slice(reading + 1)])},
          ]}
        />
      )}
    </section>
  );
}

const LESSON_MAX = 5000;

/** "Зургаас бичвэр гаргах" for a picture already in the topic. */
function StoredOcr({tid, iid, actions, onClose}: {tid: string; iid: string; actions: OcrAction[]; onClose: () => void}) {
  const url = useTopicImage(tid, iid);
  if (!url) return null;
  return <OcrDialog image={url} actions={actions} onClose={onClose} />;
}

/** Text added to a field: on a new line after what's there. */
const append = (before: string | undefined, text: string) => (before?.trim() ? `${before.trimEnd()}\n${text}` : text);

/** A picture slot: choose a file, drop one on it, or paste one (Ctrl+V) while it's selected. */
function ImageSlot(props: {
  tid: string;
  iid?: string;
  label: string;
  onChange: (iid?: string) => void;
  onUploaded: (iid: string) => void;
  /** "Зургаас бичвэр гаргах": where the text goes (e.g. "Бодлогын өгүүлбэрт нэмэх"), and adding it (with the picture kept, or not). */
  text?: {label: string; add: (text: string, dropPicture: boolean) => void};
}) {
  const {tid, iid, label, onChange, onUploaded, text} = props;
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const take = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const id = await uploadTopicImage(tid, file);
      onUploaded(id);
      onChange(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(imageFile(e.dataTransfer.items, e.dataTransfer.files));
  };
  const input = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        take(e.target.files?.[0] ?? null);
        e.target.value = '';
      }}
    />
  );
  if (iid)
    return (
      <div className="space-y-2">
        <TopicPicture tid={tid} iid={iid} className="w-full" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={small}>
            <ImagePlus size={15} /> {busy ? 'Хуулж байна…' : 'Солих'}
          </button>
          <button type="button" onClick={() => onChange(undefined)} className={small}>
            <X size={15} /> Зураг авах
          </button>
          {text && (
            <button type="button" onClick={() => setReading(true)} className={small}>
              <ScanText size={15} /> Зургаас бичвэр гаргах
            </button>
          )}
        </div>
        {input}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {reading && text && (
          <StoredOcr
            tid={tid}
            iid={iid}
            onClose={() => setReading(false)}
            actions={[
              {label: 'Нэмээд зургийг авах', run: (t) => text.add(t, true)},
              {label: text.label, primary: true, run: (t) => text.add(t, false)},
            ]}
          />
        )}
      </div>
    );
  return (
    <div>
      <div
        tabIndex={0}
        role="button"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
        onPaste={(e) => {
          const f = imageFile(e.clipboardData?.items, e.clipboardData?.files);
          if (f) {
            e.preventDefault();
            take(f);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 text-center text-sm outline-none focus-visible:border-blue-400 ${over ? 'border-blue-400 bg-blue-500/10' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
      >
        <ImagePlus size={20} />
        <span className="font-medium text-neutral-300">{busy ? 'Зураг хуулж байна…' : label}</span>
        <span className="text-xs text-neutral-500">файл сонгох · чирж оруулах · дарж байгаад Ctrl+V</span>
      </div>
      {input}
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}

/** The problem's number: a tap turns it into a box to type the place it should move to. */
function Place({no, num, count, onMove}: {no: number; num: number; count: number; onMove: (to: number) => void}) {
  const [typing, setTyping] = useState(false);
  const [v, setV] = useState('');
  const done = () => {
    setTyping(false);
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= count && n !== num) onMove(n - 1);
  };
  if (typing)
    return (
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-neutral-400">Байрлал:</span>
        <input
          autoFocus
          type="number"
          min={1}
          max={count}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={done}
          onKeyDown={(e) => (e.key === 'Enter' ? done() : e.key === 'Escape' && setTyping(false))}
          aria-label="Хэддүгээрт зөөх"
          className="w-16 rounded-lg border border-blue-500 bg-neutral-950 px-2 py-1 outline-none"
        />
        <span className="text-xs text-neutral-500">/ {count}</span>
      </label>
    );
  return (
    <button
      type="button"
      onClick={() => {
        setV(String(num));
        setTyping(true);
      }}
      disabled={count < 2}
      title={count > 1 ? 'Дарж өөр байрлал руу зөөнө' : undefined}
      className="rounded-lg px-1 font-semibold hover:bg-neutral-800 disabled:hover:bg-transparent"
    >
      {no}-р бодлого
    </button>
  );
}

/**
 * One problem in the editor. Closed it shows its picture (or text) and the right answer to tap; open, everything to
 * edit: the text, the picture, the choices' texts, the book's number, the solution.
 */
function ProblemEditor(props: {
  tid: string;
  p: Problem;
  num: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  answer: string;
  /** From the problem as it is by then (a picture may come in after more typing). */
  onChange: (f: (p: Problem) => Problem) => void;
  onAnswer: (a: string) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onCopy: () => void;
  onUploaded: (iid: string) => void;
}) {
  const {tid, p, num, count, open, onToggle, answer, onChange, onAnswer, onMove, onRemove, onCopy, onUploaded} = props;
  const [error, setError] = useState('');
  const [choiceTexts, setChoiceTexts] = useState(() => !!p.choices && Object.values(p.choices).some((c) => c?.trim()));
  const pasteImage = async (f: File) => {
    setError('');
    try {
      const iid = await uploadTopicImage(tid, f);
      onUploaded(iid);
      onChange((x) => ({...x, img: iid}));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const kind = (k: Problem['kind']) => {
    if (k === p.kind) return;
    onChange((x) => ({...x, kind: k}));
    onAnswer('');
  };
  const no = problemNo(p, num - 1);
  return (
    <div className={`rounded-2xl bg-neutral-900 p-4 sm:p-5 ${open ? 'ring-1 ring-neutral-700' : ''}`}>
      <div className="flex items-center gap-1">
        <Place no={no} num={num} count={count} onMove={onMove} />
        {!answer && <span className="ml-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-200">багш шалгана</span>}
        <span className="ml-auto flex">
          <button onClick={() => onMove(num - 2)} disabled={num === 1} aria-label="Дээш" className={icon}>
            <ArrowUp size={15} />
          </button>
          <button onClick={() => onMove(num)} disabled={num === count} aria-label="Доош" className={icon}>
            <ArrowDown size={15} />
          </button>
          <button onClick={onCopy} aria-label="Хуулбарлах" title="Хуулбарлах" className={icon}>
            <Copy size={15} />
          </button>
          <button onClick={onRemove} aria-label="Устгах" className={icon}>
            <Trash2 size={15} />
          </button>
          <button onClick={onToggle} aria-expanded={open} aria-label={open ? 'Хураах' : 'Засах'} title={open ? 'Хураах' : 'Засах'} className={`${icon} ${open ? 'text-blue-300' : ''}`}>
            {open ? <ChevronUp size={16} /> : <Pencil size={15} />}
          </button>
        </span>
      </div>

      {!open ? (
        <div className="mt-2 space-y-3">
          {p.text && (
            <button type="button" onClick={onToggle} className="block w-full text-left" aria-label="Засах">
              <Rich text={p.text} className="line-clamp-3 text-sm text-neutral-300" />
            </button>
          )}
          {p.img && <TopicPicture tid={tid} iid={p.img} className="w-full [&_img]:max-h-72" />}
          {!p.text && !p.img && (
            <button type="button" onClick={onToggle} className="w-full rounded-xl border border-dashed border-neutral-700 py-4 text-sm text-neutral-400 hover:border-neutral-500">
              Хоосон бодлого: засахын тулд дарна
            </button>
          )}
          <AnswerPicker p={p} answer={answer} onAnswer={onAnswer} onKind={kind} />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <MathArea value={p.text} onChange={(text) => onChange((x) => ({...x, text}))} max={2000} placeholder="Бодлогын өгүүлбэр (томьёо $…$ дотор). Зургийн дэлгэцийн агшныг энд шууд Ctrl+V хийж болно." onImage={pasteImage} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <ImageSlot
            tid={tid}
            iid={p.img}
            label="Бодлогын зураг (заавал биш)"
            onChange={(img) => onChange((x) => ({...x, img}))}
            onUploaded={onUploaded}
            text={{label: 'Бодлогын өгүүлбэрт нэмэх', add: (t, drop) => onChange((x) => ({...x, text: append(x.text, t), img: drop ? undefined : x.img}))}}
          />

          <div className="space-y-2">
            <p className="text-sm text-neutral-300">Зөв хариулт</p>
            <AnswerPicker p={p} answer={answer} onAnswer={onAnswer} onKind={kind} />
            <p className="text-xs text-neutral-500">
              {p.kind === 'choice' ? 'Зөв үсэг дээр дарна (дахин дарвал арилна).' : 'Хоосон зай, том жижиг үсэг, таслал ба цэгийг ялгахгүй харьцуулна.'} Хоосон орхивол сурагчдын хариулт «Шалгах»-д ирж, та шалгана.
            </p>
            {p.kind === 'choice' &&
              (choiceTexts ? (
                <div className="space-y-2">
                  {LETTER_CODES.map((l) => (
                    <div key={l} className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold">{LETTER_LABELS[l]}</span>
                      <input
                        value={p.choices?.[l] ?? ''}
                        maxLength={200}
                        onChange={(e) => {
                          const v = e.target.value;
                          onChange((x) => ({...x, choices: {...x.choices, [l]: v} as Partial<Record<Letter, string>>}));
                        }}
                        placeholder={`${LETTER_LABELS[l]} сонголт`}
                        className={`${field} py-2 text-sm`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <button type="button" onClick={() => setChoiceTexts(true)} className="text-sm text-blue-300 hover:underline">
                  + Сонголтын бичвэр нэмэх (зурган дээр байхгүй бол)
                </button>
              ))}
          </div>

          <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
            Номын дугаар
            <input
              type="number"
              min={1}
              max={9999}
              value={p.no ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onChange((x) => ({...x, no: v ? Math.max(1, Math.round(Number(v))) : undefined}));
              }}
              placeholder={String(num)}
              aria-label="Номын дугаар"
              className={`${field} w-24 py-1.5`}
            />
            <span className="text-xs text-neutral-500">Сурагчид «{no}-р бодлого» гэж харна. Хоосон бол дарааллаар нь.</span>
          </label>

          <details className="rounded-xl bg-neutral-800/40 p-3" open={!!(p.sol || p.solImg)}>
            <summary className="cursor-pointer text-sm font-medium text-neutral-300">Бодолт (заавал биш) — сурагч хариулсны дараа харагдана</summary>
            <div className="mt-3 space-y-3">
              <MathArea value={p.sol ?? ''} onChange={(sol) => onChange((x) => ({...x, sol}))} max={3000} placeholder="Хэрхэн бодох вэ…" />
              <ImageSlot
                tid={tid}
                iid={p.solImg}
                label="Бодолтын зураг"
                onChange={(solImg) => onChange((x) => ({...x, solImg}))}
                onUploaded={onUploaded}
                text={{label: 'Бодолтод нэмэх', add: (t, drop) => onChange((x) => ({...x, sol: append(x.sol, t), solImg: drop ? undefined : x.solImg}))}}
              />
            </div>
          </details>
          <button type="button" onClick={onToggle} className={`${small} ml-auto`}>
            <ChevronUp size={15} /> Хураах
          </button>
        </div>
      )}
    </div>
  );
}

/** How the picked class did: each student's first answers (against the key or the teacher's mark), and each problem. */
function Results({topic, answers, data}: {topic: Topic; answers: Record<string, string>; data: AdminData}) {
  const progress = useAllProgress();
  const marks = useAllMarks();
  if (!progress || !marks) return <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>;
  const judge = (uid: string, pid: string) => {
    const a = progress[uid]?.[topic.id]?.[pid];
    return a ? verdict(a.a, answers[pid], marks[uid]?.[topic.id]?.[pid]) : undefined;
  };
  const rows = data.students
    .map((s) => {
      const mine = progress[s.uid]?.[topic.id] ?? {};
      const done = topic.problems.filter((p) => mine[p.id]);
      return {s, mine, done: done.length, right: done.filter((p) => judge(s.uid, p.id) === true).length, waiting: done.filter((p) => judge(s.uid, p.id) === null).length};
    })
    .sort((a, b) => b.right - a.right || b.done - a.done || a.s.profile.name.localeCompare(b.s.profile.name, 'mn'));
  const started = rows.filter((r) => r.done).length;
  const n = topic.problems.length;
  const judged = rows.reduce((a, r) => a + r.done - r.waiting, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Бодсон сурагч</p>
          <p className="mt-1 text-2xl font-bold">
            {started}/{rows.length}
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Эхний оролдлогоор зөв</p>
          <p className="mt-1 text-2xl font-bold">{judged ? `${Math.round((rows.reduce((a, r) => a + r.right, 0) / judged) * 100)}%` : '—'}</p>
        </div>
      </div>

      {n > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Бодлого бүрээр</h2>
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {topic.problems.map((p, i) => {
              const got = rows.filter((r) => r.mine[p.id]);
              const vs = got.map((r) => judge(r.s.uid, p.id));
              const ok = vs.filter((v) => v === true).length;
              const wait = vs.filter((v) => v === null).length;
              const pct = got.length - wait ? Math.round((ok / (got.length - wait)) * 100) : null;
              const picks = p.kind === 'choice' ? LETTER_CODES.map((l) => [l, got.filter((r) => r.mine[p.id].a === l).length] as const) : [];
              return (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 shrink-0 font-semibold">{problemNo(p, i)}.</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-400">{p.text || (p.img ? 'Зурагтай бодлого' : '—')}</span>
                    {wait > 0 && <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-200">{wait} шалгах</span>}
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${pct === null ? 'text-neutral-500' : pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-300' : 'text-red-400'}`}>{pct === null ? '—' : `${pct}% зөв`}</span>
                    <span className="w-14 shrink-0 text-right text-xs text-neutral-500">{got.length} бодсон</span>
                  </div>
                  {picks.some(([, c]) => c) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 pl-11 text-xs">
                      {picks.map(([l, c]) => (
                        <span key={l} className={`rounded-full px-2 py-0.5 ${answers[p.id] === l ? 'bg-green-500/15 text-green-300' : c ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-800/50 text-neutral-600'}`}>
                          {LETTER_LABELS[l]}: {c}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Сурагч бүрээр</h2>
        {!rows.length ? (
          <p className="text-sm text-neutral-400">Энэ ангид сурагч алга.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {rows.map((r) => (
              <li key={r.s.uid} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/admin/student/${r.s.uid}`} className="min-w-0 flex-1 truncate hover:underline">
                  {r.s.profile.name}
                </Link>
                {r.waiting > 0 && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-200">{r.waiting} шалгах</span>}
                <span className="text-sm tabular-nums text-neutral-300">{r.done ? `${r.right}/${n} зөв` : <span className="text-neutral-500">эхлээгүй</span>}</span>
                <span className="w-16 text-right text-xs text-neutral-500">
                  {r.done}/{n} бодсон
                </span>
                <button
                  onClick={() => confirm(`${r.s.profile.name}-ийн энэ сэдвийн хариултыг устгаж, дахин эхнээс нь бодуулах уу?`) && resetProgress(r.s.uid, topic.id).catch((e) => alert(`Алдаа: ${(e as Error).message}`))}
                  disabled={!r.done}
                  aria-label="Дахин бодуулах"
                  title="Дахин бодуулах"
                  className={icon}
                >
                  <RotateCcw size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
