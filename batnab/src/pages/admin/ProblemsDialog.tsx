import {AlertTriangle, Check, Combine, ListOrdered, Loader2, Scissors, X} from 'lucide-react';
import {useEffect, useRef, useState, type PointerEvent} from 'react';
import Sheet from '../../components/Sheet';
import ZoomView from '../../components/ZoomView';
import {canvasFile, cropProblem, readPage, type Page} from '../../lib/pageSplit';
import {hasChoices, parseChoices, widestGap, type Region} from '../../lib/splitProblems';
import {LETTER_CODES, newId, uploadTopicImage, type Letter, type Problem} from '../../lib/topics';
import AnswerPicker from './AnswerPicker';
import {MathArea} from './MathField';

type Use = 'img' | 'text' | 'both';
interface Item {
  id: number;
  num: number;
  guessed?: boolean;
  regions: Region[];
  text: string;
  /** What the problem is made of: its picture cut from the page (always, unless the teacher picks the read text). */
  use: Use;
  kind: Problem['kind'];
  /** The right answer picked here ('' none: the teacher checks the students' answers). */
  key: string;
  on: boolean;
  thumb: string;
}

const USES: [Use, string][] = [
  ['img', 'Зураг'],
  ['text', 'Бичвэр'],
  ['both', 'Хоёулаа'],
];
const pill = 'flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm font-medium hover:bg-neutral-700 disabled:opacity-40';

let ids = 0;
const thumb = (page: Page, regions: Region[]) => cropProblem(page, regions).toDataURL('image/jpeg', 0.85);
function itemsOf(page: Page): Item[] {
  // Nothing numbered found: the whole page as one problem, to cut by hand.
  const all = [...page.lines]
    .sort((a, b) => a.col - b.col || a.bbox.y0 - b.bbox.y0)
    .map((l) => l.text)
    .filter(Boolean)
    .join('\n');
  const found = page.problems.length ? page.problems : [{num: 1, guessed: true, text: all, regions: [{col: -1, x0: 0, y0: 0, x1: page.canvas.width, y1: page.canvas.height}]}];
  const choice = found.map((f) => hasChoices(f.text) || !!parseChoices(f.text));
  // A test's page: when most problems show А)–Д), so do the rest (choices written as formulas are not read).
  const test = choice.filter(Boolean).length >= found.length * 0.6;
  // As the picture: read text comes out wrong too often (formulas above all) to be used unless picked by hand.
  return found.map((f, i) => ({id: ids++, num: f.num, guessed: f.guessed, regions: f.regions, text: f.text, use: 'img', kind: choice[i] || test ? 'choice' : 'answer', key: '', on: true, thumb: thumb(page, f.regions)}));
}

/** Whether the numbers go 1 by 1 (n, n+1, …): when not, one was read or cut wrong. */
const inOrder = (xs: Item[]) => xs.every((it, i) => i === 0 || it.num === xs[i - 1].num + 1);

/** A problem's number: a tap turns it into a box to write the right one. */
function Num({value, onChange}: {value: number; onChange: (n: number) => void}) {
  const [v, setV] = useState<string | null>(null);
  const done = () => {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 9999) onChange(n);
    setV(null);
  };
  if (v !== null)
    return (
      <input
        autoFocus
        type="number"
        min={1}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={done}
        onKeyDown={(e) => (e.key === 'Enter' ? done() : e.key === 'Escape' && setV(null))}
        aria-label="Бодлогын дугаар"
        className="w-16 rounded-lg border border-blue-500 bg-neutral-950 px-2 py-0.5 font-semibold outline-none"
      />
    );
  return (
    <button type="button" onClick={() => setV(String(value))} title="Дугаарыг засах" className="rounded-md px-1 font-semibold underline decoration-neutral-600 decoration-dotted underline-offset-4 hover:bg-neutral-800">
      {value}
    </button>
  );
}

/**
 * "Зургаас бодлогууд": a photo of a book's page (or several) becomes one problem per numbered problem on it, each its
 * own picture cut from the page, so formulas and figures stay exactly as printed (the read text only when picked).
 * The boxes can be fixed by hand on the page, the numbers corrected, and the right answers picked before adding.
 */
export default function ProblemsDialog({files, tid, onAdd, onUploaded, onClose}: {files: File[]; tid: string; onAdd: (ps: Problem[], keys: Record<string, string>) => void; onUploaded: (iid: string) => void; onClose: () => void}) {
  const [at, setAt] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [pageUrl, setPageUrl] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [progress, setProgress] = useState({p: 0, stage: 'Бэлдэж байна'});
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [adding, setAdding] = useState<{done: number; total: number} | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const overview = useRef<HTMLDivElement>(null);
  const drag = useRef<{id: number; edge: 'top' | 'bottom'} | null>(null);

  useEffect(() => {
    let live = true;
    setPage(null);
    setItems([]);
    setSel(null);
    setError('');
    readPage(files[at], (p, stage) => live && setProgress({p, stage}))
      .then((pg) => {
        if (!live) return;
        setPage(pg);
        setPageUrl(pg.canvas.toDataURL('image/jpeg', 0.85));
        setItems(itemsOf(pg));
      })
      .catch((e) => live && setError(/fetch|network|load/i.test(String(e?.message ?? e)) ? 'Интернэт холболтоо шалгаад дахин оролдоно уу.' : `Уншиж чадсангүй: ${e?.message ?? e}`));
    return () => {
      live = false;
    };
  }, [files, at, attempt]);

  const edit = (id: number, f: (it: Item) => Item) => setItems((xs) => xs.map((it) => (it.id === id ? f(it) : it)));
  const reshape = (id: number, regions: Region[]) => page && edit(id, (it) => ({...it, regions, thumb: thumb(page, regions)}));
  const chosen = items.filter((it) => it.on);
  const selected = items.find((it) => it.id === sel);
  const W = page?.canvas.width ?? 1;
  const H = page?.canvas.height ?? 1;
  const dupes = new Set(chosen.map((it) => it.num).filter((n, i, xs) => xs.indexOf(n) !== i));
  /** The numbers 1 by 1 from the first one's, in the order on the page. */
  const renumber = () => setItems((xs) => xs.map((it, i) => ({...it, num: (xs[0]?.num ?? 1) + i, guessed: false})));

  /** Takes the problem into the one before it (it was one problem cut in two). */
  const merge = (id: number) => {
    const k = items.findIndex((it) => it.id === id);
    if (k < 1 || !page) return;
    const a = items[k - 1];
    const b = items[k];
    const last = a.regions[a.regions.length - 1];
    const [first, ...rest] = b.regions;
    const regions =
      last.col === first.col
        ? [...a.regions.slice(0, -1), {col: last.col, x0: Math.min(last.x0, first.x0), x1: Math.max(last.x1, first.x1), y0: Math.min(last.y0, first.y0), y1: Math.max(last.y1, first.y1)}, ...rest]
        : [...a.regions, ...b.regions];
    const text = [a.text, b.text].filter(Boolean).join('\n');
    setItems([...items.slice(0, k - 1), {...a, regions, text, key: a.key || b.key, thumb: thumb(page, regions)}, ...items.slice(k + 1)]);
    setSel(a.id);
  };
  /** Cuts the box in two at its widest blank (it held two problems). */
  const split = (id: number) => {
    const k = items.findIndex((it) => it.id === id);
    if (k < 0 || !page) return;
    const it = items[k];
    let a: Region[];
    let b: Region[];
    if (it.regions.length > 1) [a, b] = [it.regions.slice(0, 1), it.regions.slice(1)];
    else {
      const r = it.regions[0];
      const y = r.col >= 0 ? widestGap(page.rowInk[r.col], Math.round(r.y0), Math.round(r.y1)) : Math.round((r.y0 + r.y1) / 2);
      [a, b] = [[{...r, y1: y}], [{...r, y0: y}]];
    }
    const second: Item = {...it, id: ids++, num: it.num + 1, guessed: true, regions: b, text: '', use: 'img', key: '', thumb: thumb(page, b)};
    setItems([...items.slice(0, k), {...it, regions: a, thumb: thumb(page, a)}, second, ...items.slice(k + 1)]);
  };

  const yAt = (clientY: number) => {
    const r = overview.current!.getBoundingClientRect();
    return Math.min(H, Math.max(0, ((clientY - r.top) / r.height) * H));
  };
  const down = (e: PointerEvent, id: number, edge: 'top' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {id, edge};
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const y = yAt(e.clientY);
    setItems((xs) =>
      xs.map((it) => {
        if (it.id !== d.id) return it;
        const regions = [...it.regions];
        const i = d.edge === 'top' ? 0 : regions.length - 1;
        const r = regions[i];
        regions[i] = d.edge === 'top' ? {...r, y0: Math.min(y, r.y1 - 16)} : {...r, y1: Math.max(y, r.y0 + 16)};
        return {...it, regions};
      }),
    );
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    const it = d && items.find((x) => x.id === d.id);
    if (it) reshape(it.id, it.regions);
  };

  const add = async () => {
    if (!page || !chosen.length) return;
    setAdding({done: 0, total: chosen.length});
    setError('');
    try {
      const out: Problem[] = [];
      const keys: Record<string, string> = {};
      for (const it of chosen) {
        let img: string | undefined;
        if (it.use !== 'text') {
          img = await uploadTopicImage(tid, await canvasFile(cropProblem(page, it.regions), `bodlogo-${it.num}.png`));
          onUploaded(img);
        }
        let text = it.use === 'img' ? '' : it.text.trim();
        let choices: Partial<Record<Letter, string>> | undefined;
        const parsed = it.use !== 'img' && it.kind === 'choice' ? parseChoices(text) : null;
        if (parsed) {
          text = parsed.stem;
          choices = Object.fromEntries(parsed.choices.slice(0, 5).map((c, j) => [LETTER_CODES[j], c.slice(0, 200)]));
        }
        const id = newId();
        out.push({id, text: text.slice(0, 2000), ...(img ? {img} : {}), kind: it.kind, no: it.num, ...(choices ? {choices} : {})});
        if (it.key) keys[id] = it.key;
        setAdding({done: out.length, total: chosen.length});
      }
      onAdd(out, keys);
      if (at + 1 < files.length) setAt(at + 1);
      else onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(null);
    }
  };

  // Not closed halfway through adding (what was added so far would come in after all).
  const close = () => !adding && onClose();
  const many = files.length > 1 ? ` · ${at + 1}/${files.length}-р хуудас` : '';
  const answered = chosen.filter((it) => it.key).length;

  return (
    <Sheet title={`Зургаас бодлогууд${many}`} sub="Номын хуудсан дээрх дугаартай бодлого бүрийг тусад нь зураг болгон тасдаж нэмнэ: томьёо, дүрс яг хэвээрээ." onClose={close} wide>
      {error ? (
        <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          {error}
          {!page && (
            <button onClick={() => setAttempt((n) => n + 1)} className="mt-3 block rounded-full bg-neutral-800 px-4 py-1.5 font-medium text-neutral-100 hover:bg-neutral-700">
              Дахин оролдох
            </button>
          )}
        </div>
      ) : null}
      {!page && !error && (
        <div className="rounded-xl bg-neutral-800/50 p-4" role="status">
          <p className="flex items-center gap-2 text-sm text-neutral-300">
            <Loader2 size={16} className="animate-spin" /> {progress.stage}… {Math.round(progress.p * 100)}%
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full bg-violet-400 transition-[width]" style={{width: `${Math.round(progress.p * 100)}%`}} />
          </div>
          <p className="mt-3 text-xs text-neutral-500">Зургийг тэгшилж, цайруулаад багана бүрийг уншина (хуудас бүрт 10–30 секунд). Анх удаа хэлний өгөгдлийг (≈4 MB) татна.</p>
        </div>
      )}

      {page && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="md:sticky md:top-0 md:self-start">
            {/* On a wide screen the whole page stays in view, with room for the box's tools under it. */}
            <div ref={overview} className="relative touch-pan-y select-none overflow-hidden rounded-xl bg-white md:mx-auto md:w-fit" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <img src={pageUrl} alt="Хуудас" draggable={false} className="block w-full md:max-h-[50dvh] md:w-auto md:max-w-full" />
              {items.map((it) =>
                it.regions.map((r, j) => (
                  <button
                    key={`${it.id}-${j}`}
                    type="button"
                    onClick={() => setSel(sel === it.id ? null : it.id)}
                    aria-label={`${it.num}-р бодлогын хүрээ`}
                    aria-pressed={sel === it.id}
                    className={`absolute rounded-sm border-2 text-left ${sel === it.id ? 'z-10 border-blue-500 bg-blue-500/15' : it.on ? 'border-emerald-500/80 hover:bg-emerald-500/10' : 'border-dashed border-neutral-400 bg-neutral-900/30'}`}
                    style={{left: `${(r.x0 / W) * 100}%`, top: `${(r.y0 / H) * 100}%`, width: `${((r.x1 - r.x0) / W) * 100}%`, height: `${((r.y1 - r.y0) / H) * 100}%`}}
                  >
                    {j === 0 && <span className={`absolute left-0 top-0 rounded-br px-1 text-[10px] font-bold leading-4 text-white ${sel === it.id ? 'bg-blue-500' : dupes.has(it.num) ? 'bg-amber-600' : it.on ? 'bg-emerald-600' : 'bg-neutral-500'}`}>{it.num}</span>}
                  </button>
                )),
              )}
              {selected &&
                (['top', 'bottom'] as const).map((edge) => {
                  const r = edge === 'top' ? selected.regions[0] : selected.regions[selected.regions.length - 1];
                  const y = edge === 'top' ? r.y0 : r.y1;
                  return (
                    <div
                      key={edge}
                      role="slider"
                      aria-label={edge === 'top' ? 'Дээд хүрээ' : 'Доод хүрээ'}
                      aria-valuenow={Math.round(y)}
                      aria-valuemin={0}
                      aria-valuemax={H}
                      tabIndex={0}
                      onPointerDown={(e) => down(e, selected.id, edge)}
                      onKeyDown={(e) => {
                        const d = e.key === 'ArrowUp' ? -8 : e.key === 'ArrowDown' ? 8 : 0;
                        if (!d) return;
                        e.preventDefault();
                        const regions = [...selected.regions];
                        const i = edge === 'top' ? 0 : regions.length - 1;
                        regions[i] = edge === 'top' ? {...regions[i], y0: Math.min(regions[i].y0 + d, regions[i].y1 - 16)} : {...regions[i], y1: Math.max(regions[i].y1 + d, regions[i].y0 + 16)};
                        reshape(selected.id, regions);
                      }}
                      className="absolute z-20 flex h-7 -translate-y-1/2 cursor-ns-resize touch-none items-center justify-center outline-none"
                      style={{left: `${(r.x0 / W) * 100}%`, width: `${((r.x1 - r.x0) / W) * 100}%`, top: `${(y / H) * 100}%`}}
                    >
                      <span className="h-1.5 w-14 rounded-full bg-blue-500 shadow ring-2 ring-white" />
                    </div>
                  );
                })}
            </div>
            {selected ? (
              <div className="mt-2 rounded-xl bg-neutral-800/60 p-3">
                <p className="text-sm font-semibold">
                  {selected.num}-р бодлого <span className="font-normal text-neutral-400">· хөх зураасыг чирж дээд, доод хүрээг тохируулна</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => merge(selected.id)} disabled={items[0]?.id === selected.id} className={pill}>
                    <Combine size={15} /> Өмнөхтэй нэгтгэх
                  </button>
                  <button type="button" onClick={() => split(selected.id)} className={pill}>
                    <Scissors size={15} /> Хоёр хуваах
                  </button>
                  <button type="button" onClick={() => edit(selected.id, (it) => ({...it, on: !it.on}))} className={pill}>
                    {selected.on ? <X size={15} /> : <Check size={15} />} {selected.on ? 'Нэмэхгүй' : 'Нэмэх'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-neutral-500">Хүрээн дээр дарж сонгоод хэмжээг нь засах, нэгтгэх, хуваах боломжтой.</p>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            {page.problems.length === 0 && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">Дугаартай бодлого олдсонгүй. Бүх хуудсыг нэг бодлого болгосон: хүрээг нь тохируулж эсвэл «Хоёр хуваах»-аар хуваана уу.</p>}
            {items.length > 1 && (dupes.size > 0 || !inOrder(items)) && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">
                <AlertTriangle size={16} className="shrink-0" />
                <span className="min-w-0 flex-1">{dupes.size ? `Давхацсан дугаар: ${[...dupes].join(', ')}.` : 'Дугаар алгассан байна.'} Дугаар дээр дарж засна, эсвэл:</span>
                <button type="button" onClick={renumber} className={`${pill} text-neutral-100`}>
                  <ListOrdered size={15} /> {items[0].num}-с дарааллаар дугаарлах
                </button>
              </div>
            )}
            <p className="text-xs text-neutral-500">Бодлого бүр зураг хэлбэрээр нэмэгдэнэ. Бичвэр хэрэгтэй бол «Бичвэр» эсвэл «Хоёулаа»-г гараар сонгоно. Зөв хариултыг энд сонгож болно; сонгоогүй бодлогын сурагчдын хариултыг та «Шалгах»-д шалгана.</p>
            {items.map((it) => (
              <div key={it.id} className={`rounded-2xl border p-3 ${sel === it.id ? 'border-blue-500/70 bg-blue-500/5' : 'border-neutral-800 bg-neutral-900'} ${it.on ? '' : 'opacity-50'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="checkbox" checked={it.on} onChange={() => edit(it.id, (x) => ({...x, on: !x.on}))} aria-label={`${it.num}-р бодлогыг нэмэх`} className="h-4 w-4 accent-blue-500" />
                  <span className="flex items-center gap-0.5 font-semibold">
                    <Num value={it.num} onChange={(num) => edit(it.id, (x) => ({...x, num, guessed: false}))} />
                    -р бодлого
                  </span>
                  {it.guessed && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200" title="Дугаарыг нь уншиж чадаагүй тул байрлалаар нь таамагласан">
                      дугаарыг шалгана уу
                    </span>
                  )}
                  {dupes.has(it.num) && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">давхацсан</span>}
                </div>
                <button type="button" onClick={() => setSel(it.id)} onDoubleClick={() => setZoom(it.thumb)} className="mt-2 block w-full overflow-hidden rounded-lg bg-white" aria-label={`${it.num}-р бодлогыг хуудсан дээр сонгох`}>
                  <img src={it.thumb} alt="" className="mx-auto max-h-48 w-auto max-w-full" />
                </button>
                <div className="mt-2">
                  <AnswerPicker p={{id: '', text: '', kind: it.kind}} answer={it.key} onAnswer={(key) => edit(it.id, (x) => ({...x, key}))} onKind={(kind) => edit(it.id, (x) => (x.kind === kind ? x : {...x, kind, key: ''}))} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex rounded-full bg-neutral-800 p-0.5 text-xs" role="radiogroup" aria-label="Юугаар нэмэх">
                    {USES.map(([u, label]) => (
                      <button key={u} type="button" role="radio" aria-checked={it.use === u} onClick={() => edit(it.id, (x) => ({...x, use: u}))} className={`rounded-full px-3 py-1 font-medium ${it.use === u ? 'bg-neutral-600 text-white' : 'text-neutral-400'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setZoom(it.thumb)} className="text-xs text-neutral-400 hover:underline">
                    Томоор харах
                  </button>
                </div>
                {it.use !== 'img' && (
                  <div className="mt-2">
                    <MathArea value={it.text} onChange={(text) => edit(it.id, (x) => ({...x, text}))} max={2000} rows={4} label={`${it.num}-р бодлогын бичвэр`} placeholder="Бодлогын бичвэр (томьёо $…$ дотор)" />
                    <p className="mt-1 text-xs text-amber-200/80">Уншсан бичвэр ихэвчлэн алдаатай: зурагтай тулгаж засна уу.{it.kind === 'choice' && ' А) … Д) сонголтуудыг бичвэрээс өөрөө салгана.'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Down over the panel's bottom padding too, so the list doesn't show beneath it. */}
      <div className="sticky -bottom-[max(1.25rem,env(safe-area-inset-bottom))] -mx-5 -mb-[max(1.25rem,env(safe-area-inset-bottom))] mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-800 bg-neutral-900 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {page && (
          <span className="mr-auto text-sm text-neutral-400">
            {chosen.length}/{items.length} сонгосон{answered > 0 && ` · ${answered} хариулттай`}
          </span>
        )}
        <button onClick={close} disabled={!!adding} className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50">
          Болих
        </button>
        <button onClick={add} disabled={!page || !chosen.length || !!adding} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
          {adding ? `Нэмж байна ${adding.done}/${adding.total}…` : `${chosen.length} бодлого нэмэх`}
        </button>
      </div>
      {zoom && <ZoomView url={zoom} onClose={() => setZoom(null)} />}
    </Sheet>
  );
}
