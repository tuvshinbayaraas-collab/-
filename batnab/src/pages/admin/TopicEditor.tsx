import {ArrowDown, ArrowLeft, ArrowUp, BarChart3, Check, Copy, Eye, ImagePlus, Images, ListChecks, Pencil, Plus, RotateCcw, ScanText, School, Trash2, Type, X} from 'lucide-react';
import {useEffect, useRef, useState, type DragEvent, type ReactNode} from 'react';
import Switch, {SavedNote, useSavedNote} from '../../components/Switch';
import {TopicPicture} from '../../components/TopicParts';
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
  normalize,
  resetProgress,
  saveTopic,
  uploadTopicImage,
  useAllProgress,
  useTopicImage,
  useTopicKeys,
  useTopics,
  type Block,
  type Letter,
  type Problem,
  type Topic,
} from '../../lib/topics';
import type {AdminData} from './data';
import BulkAnswers from './BulkAnswers';
import {field, MathArea} from './MathField';
import OcrDialog, {type OcrAction} from './OcrDialog';
import ProblemsDialog from './ProblemsDialog';

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
  const [draft, setDraft] = useState<Topic>(() => structuredClone(topic));
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({...keys}));
  const [saved, setSaved] = useState(() => snapshot(topic, keys));
  const [mode, setMode] = useState<'edit' | 'results'>('edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, flash] = useSavedNote();
  // "Зургаас бодлогууд": the photos of book pages being cut into problems; "Хариултуудыг нэг дор".
  const [pages, setPages] = useState<File[] | null>(null);
  const [bulk, setBulk] = useState(false);
  const pagesRef = useRef<HTMLInputElement>(null);
  // Pictures the topic used when opened, and the ones added since: whatever of these the topic no longer uses is
  // deleted when it's saved.
  const known = useRef(imagesOf(topic));
  const dirty = snapshot(draft, answers) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (f: (t: Topic) => Topic) => setDraft((t) => f(structuredClone(t)));
  const uploaded = (iid: string) => known.current.add(iid);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const used = imagesOf(draft);
      await saveTopic(draft, answers, [...known.current].filter((i) => !used.has(i)));
      known.current = used;
      setSaved(snapshot(draft, answers));
      flash();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (dirty && !confirm('Хадгалсан хувилбарыг хуулна (хадгалаагүй өөрчлөлт орохгүй). Үргэлжлүүлэх үү?')) return;
    try {
      const all = topics ?? [];
      navigate(`/admin/topic/${await copyTopic(topic, keys, Math.max(Date.now(), ...all.map((t) => t.order + 1)))}`);
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
    }
  };
  const remove = async () => {
    if (!confirm(`«${draft.title}» сэдвийг хичээл, бодлого, зураг, сурагчдын хариултын хамт устгах уу?`)) return;
    await deleteTopic(draft.id).catch((e) => alert(`Алдаа: ${(e as Error).message}`));
    navigate('/admin?tab=topics');
  };
  const leave = (href: string) => (!dirty || confirm('Хадгалаагүй өөрчлөлт алга болно. Гарах уу?')) && navigate(href);
  const open = draft.problems.filter((p) => !answers[p.id]).length;

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
              ['results', 'Үр дүн', BarChart3],
            ] as const
          ).map(([m, label, I]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${mode === m ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}>
              <I size={15} /> {label}
            </button>
          ))}
        </div>
        <button onClick={() => leave(`/topics/${draft.id}`)} className={`${small} ml-auto`}>
          <Eye size={15} /> Сурагчаар харах
        </button>
      </div>

      {mode === 'results' ? (
        <Results topic={topic} data={data} />
      ) : (
        <>
          <Card>
            <input
              value={draft.title}
              maxLength={80}
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
                  <span className="block text-sm text-neutral-400">{draft.published ? 'Сурагчид «Сэдвүүд»-ээс харж, бодлогоо бодно.' : 'Ноорог: зөвхөн та харна. Бэлэн болмогц асаагаад хадгална.'}</span>
                </span>
              </Switch>
            </div>
          </Card>

          <Lesson topic={draft} onChange={(lesson) => change((t) => ({...t, lesson}))} onUploaded={uploaded} />

          <section className="space-y-3">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold">
              Бодлого ({draft.problems.length})
              {open > 0 && <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-400">{open} нь хариултгүй</span>}
              {draft.problems.length > 1 && (
                <button onClick={() => setBulk(true)} className={`${small} ml-auto font-normal`}>
                  <ListChecks size={15} /> Хариултуудыг нэг дор
                </button>
              )}
            </h2>
            {draft.problems.map((p, i) => (
              <ProblemEditor
                key={p.id}
                tid={draft.id}
                p={p}
                num={i + 1}
                count={draft.problems.length}
                answer={answers[p.id] ?? ''}
                onUploaded={uploaded}
                onChange={(q) => change((t) => ({...t, problems: t.problems.map((x) => (x.id === p.id ? q : x))}))}
                onAnswer={(a) => setAnswers((k) => ({...k, [p.id]: a}))}
                onMove={(d) => change((t) => ({...t, problems: swap(t.problems, i, i + d)}))}
                onRemove={() => confirm(`${i + 1}-р бодлогыг устгах уу?`) && change((t) => ({...t, problems: t.problems.filter((x) => x.id !== p.id)}))}
                onCopy={() => {
                  const id = newId();
                  change((t) => ({...t, problems: [...t.problems.slice(0, i + 1), {...structuredClone(p), id}, ...t.problems.slice(i + 1)]}));
                  if (answers[p.id]) setAnswers((k) => ({...k, [id]: answers[p.id]}));
                }}
              />
            ))}
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => change((t) => ({...t, problems: [...t.problems, {id: newId(), text: '', kind: 'choice'}]}))} className={addButton}>
                <Plus size={18} /> Бодлого нэмэх
              </button>
              <button onClick={() => pagesRef.current?.click()} className={addButton}>
                <Images size={18} /> Зургаас бодлогууд
              </button>
            </div>
            <p className="text-xs text-neutral-500">«Зургаас бодлогууд»: номын хуудасны зургийг (хэд хэдийг ч болно) оруулбал дугаартай бодлого бүрийг тусад нь тасдаж, томьёо, дүрсийг нь хэвээр нь зураг болгон нэмнэ.</p>
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
                onAdd={(ps) => change((t) => ({...t, problems: [...t.problems, ...ps]}))}
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

          <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/95 px-4 py-3 shadow-xl backdrop-blur">
            <span className={`min-w-0 flex-1 text-sm ${dirty ? 'text-amber-300' : 'text-neutral-400'}`}>
              {error ? <span className="text-red-400">Хадгалж чадсангүй: {error}</span> : dirty ? 'Хадгалаагүй өөрчлөлт байна' : 'Бүх өөрчлөлт хадгалагдсан'}
            </span>
            <button onClick={save} disabled={busy || !dirty || !draft.title.trim()} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
              <Check size={16} /> {busy ? 'Хадгалж байна…' : 'Хадгалах'}
            </button>
          </div>
        </>
      )}
      <SavedNote show={note} />
    </div>
  );
}

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
function Lesson({topic, onChange, onUploaded}: {topic: Topic; onChange: (b: Block[]) => void; onUploaded: (iid: string) => void}) {
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
      onChange([...blocks, {t: 'img', img: iid}]);
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
                onChange([...blocks, {t: 'img', img: iid}, ...paragraphs(text)]);
              },
            },
            {label: 'Бичвэр болгож нэмэх', primary: true, run: (text) => onChange([...blocks, ...paragraphs(text)])},
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

function ProblemEditor(props: {
  tid: string;
  p: Problem;
  num: number;
  count: number;
  answer: string;
  onChange: (p: Problem) => void;
  onAnswer: (a: string) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onCopy: () => void;
  onUploaded: (iid: string) => void;
}) {
  const {tid, p, num, count, answer, onChange, onAnswer, onMove, onRemove, onCopy, onUploaded} = props;
  const [error, setError] = useState('');
  const pasteImage = async (f: File) => {
    setError('');
    try {
      const iid = await uploadTopicImage(tid, f);
      onUploaded(iid);
      onChange({...p, img: iid});
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const kind = (k: Problem['kind']) => {
    if (k === p.kind) return;
    onChange({...p, kind: k});
    onAnswer('');
  };
  return (
    <div className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
      <div className="flex items-center gap-1">
        <span className="font-semibold">{num}-р бодлого</span>
        {!answer && <span className="ml-2 rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">хариултгүй</span>}
        <span className="ml-auto flex">
          <button onClick={() => onMove(-1)} disabled={num === 1} aria-label="Дээш" className={icon}>
            <ArrowUp size={15} />
          </button>
          <button onClick={() => onMove(1)} disabled={num === count} aria-label="Доош" className={icon}>
            <ArrowDown size={15} />
          </button>
          <button onClick={onCopy} aria-label="Хуулбарлах" title="Хуулбарлах" className={icon}>
            <Copy size={15} />
          </button>
          <button onClick={onRemove} aria-label="Устгах" className={icon}>
            <Trash2 size={15} />
          </button>
        </span>
      </div>
      <div className="mt-3 space-y-3">
        <MathArea value={p.text} onChange={(text) => onChange({...p, text})} max={2000} placeholder="Бодлогын өгүүлбэр (томьёо $…$ дотор). Зургийн дэлгэцийн агшныг энд шууд Ctrl+V хийж болно." onImage={pasteImage} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <ImageSlot
          tid={tid}
          iid={p.img}
          label="Бодлогын зураг (заавал биш)"
          onChange={(img) => onChange({...p, img})}
          onUploaded={onUploaded}
          text={{label: 'Бодлогын өгүүлбэрт нэмэх', add: (t, drop) => onChange({...p, text: append(p.text, t), img: drop ? undefined : p.img})}}
        />

        <div>
          <div className="flex rounded-full bg-neutral-800 p-1 text-sm" role="radiogroup" aria-label="Хариултын төрөл">
            {(
              [
                ['choice', 'А–Д сонголт'],
                ['answer', 'Хариулт бичих'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={p.kind === k} onClick={() => kind(k)} className={`flex-1 rounded-full px-3 py-1.5 font-medium ${p.kind === k ? 'bg-neutral-600 text-white' : 'text-neutral-400'}`}>
                {label}
              </button>
            ))}
          </div>
          {p.kind === 'choice' ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-neutral-500">
                Зөв хариултын үсэг дээр дарна (заавал биш: сонгоогүй бол сурагч өөрөө бодоод бодолтыг харна). Сонголтын бичвэр заавал биш (зурган дээр байвал хоосон орхино).
              </p>
              {LETTER_CODES.map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAnswer(answer === l ? '' : l)}
                    aria-pressed={answer === l}
                    aria-label={`${LETTER_LABELS[l]} зөв хариулт`}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${answer === l ? 'bg-green-500 text-black' : 'bg-neutral-800 hover:bg-neutral-700'}`}
                  >
                    {answer === l ? <Check size={16} /> : LETTER_LABELS[l]}
                  </button>
                  <input
                    value={p.choices?.[l] ?? ''}
                    maxLength={200}
                    onChange={(e) => onChange({...p, choices: {...p.choices, [l]: e.target.value} as Partial<Record<Letter, string>>})}
                    placeholder={`${LETTER_LABELS[l]} сонголт`}
                    className={`${field} py-2 text-sm`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <label className="mt-3 block">
              <span className="text-sm text-neutral-300">Зөв хариулт (заавал биш)</span>
              <input value={answer} maxLength={40} onChange={(e) => onAnswer(normalize(e.target.value))} placeholder="Жишээ: 12, -3.5, 2/3" className={`${field} mt-1 sm:w-64`} />
              <span className="mt-1 block text-xs text-neutral-500">Хоосон зай, том жижиг үсэг, таслал ба цэгийг ялгахгүй харьцуулна. Хоосон бол сурагч өөрөө бодоод бодолтыг харна.</span>
            </label>
          )}
        </div>

        <details className="rounded-xl bg-neutral-800/40 p-3" open={!!(p.sol || p.solImg)}>
          <summary className="cursor-pointer text-sm font-medium text-neutral-300">
            Бодолт (заавал биш) — {answer ? 'сурагч хариулсны дараа харагдана' : 'сурагч «Бодолт харах»-аар харна'}
          </summary>
          <div className="mt-3 space-y-3">
            <MathArea value={p.sol ?? ''} onChange={(sol) => onChange({...p, sol})} max={3000} placeholder="Хэрхэн бодох вэ…" />
            <ImageSlot
              tid={tid}
              iid={p.solImg}
              label="Бодолтын зураг"
              onChange={(solImg) => onChange({...p, solImg})}
              onUploaded={onUploaded}
              text={{label: 'Бодолтод нэмэх', add: (t, drop) => onChange({...p, sol: append(p.sol, t), solImg: drop ? undefined : p.solImg})}}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

/** How the picked class did: each student's first answers, and each problem. */
function Results({topic, data}: {topic: Topic; data: AdminData}) {
  const progress = useAllProgress();
  const keys = useTopicKeys(topic.id);
  if (!progress || !keys) return <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>;
  const rows = data.students
    .map((s) => {
      const mine = progress[s.uid]?.[topic.id] ?? {};
      const done = topic.problems.filter((p) => mine[p.id]);
      return {s, mine, done: done.length, right: done.filter((p) => keys[p.id] && mine[p.id].a === keys[p.id]).length};
    })
    .sort((a, b) => b.right - a.right || b.done - a.done || a.s.profile.name.localeCompare(b.s.profile.name, 'mn'));
  const started = rows.filter((r) => r.done).length;
  const n = topic.problems.length;
  // Problems without a right answer can't be done (students work them out and look at the solution).
  const counted = topic.problems.filter((p) => keys[p.id]).length;

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
          <p className="mt-1 text-2xl font-bold">
            {(() => {
              const d = rows.reduce((a, r) => a + r.done, 0);
              return d ? `${Math.round((rows.reduce((a, r) => a + r.right, 0) / d) * 100)}%` : '—';
            })()}
          </p>
        </div>
      </div>

      {n > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Бодлого бүрээр</h2>
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {topic.problems.map((p, i) => {
              const got = rows.filter((r) => r.mine[p.id]);
              const ok = got.filter((r) => keys[p.id] && r.mine[p.id].a === keys[p.id]).length;
              const pct = got.length ? Math.round((ok / got.length) * 100) : null;
              const picks = p.kind === 'choice' ? LETTER_CODES.map((l) => [l, got.filter((r) => r.mine[p.id].a === l).length] as const) : [];
              return (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 shrink-0 font-semibold">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-400">{p.text || (p.img ? 'Зурагтай бодлого' : '—')}</span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${pct === null ? 'text-neutral-500' : pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-300' : 'text-red-400'}`}>
                      {pct === null ? (keys[p.id] ? '—' : 'хариултгүй') : `${pct}% зөв`}
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs text-neutral-500">{got.length} бодсон</span>
                  </div>
                  {picks.some(([, c]) => c) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 pl-11 text-xs">
                      {picks.map(([l, c]) => (
                        <span key={l} className={`rounded-full px-2 py-0.5 ${keys[p.id] === l ? 'bg-green-500/15 text-green-300' : c ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-800/50 text-neutral-600'}`}>
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
                <span className="text-sm tabular-nums text-neutral-300">{r.done ? `${r.right}/${n} зөв` : <span className="text-neutral-500">эхлээгүй</span>}</span>
                <span className="w-16 text-right text-xs text-neutral-500">
                  {r.done}/{counted} бодсон
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
