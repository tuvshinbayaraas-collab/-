import {ArrowLeft, Printer} from 'lucide-react';
import {useEffect, useState} from 'react';
import {CenterNote, LockedNote} from '../components/Notices';
import {Rich} from '../components/TopicParts';
import {useLive} from '../lib/live';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {LETTER_CODES, LETTER_LABELS, problemNo, useTopicImage, useTopics, type Letter, type Problem} from '../lib/topics';

type Space = 'none' | 'small' | 'big';
const SPACE: Record<Space, string> = {none: '', small: 'h-24', big: 'h-56'};
const SPACES: [Space, string][] = [
  ['none', 'Зайгүй'],
  ['small', 'Бага'],
  ['big', 'Их'],
];

/**
 * /print/topic/{id} (the teacher): a topic as a worksheet on paper — a line for the name, class and date, the problems
 * with their pictures and choices and room to work, the lesson if wanted, and the answers on a page of their own. It
 * prints on white whatever the site's look; the choices above it don't print.
 */
export default function PrintTopic({id}: {id: string}) {
  const session = useSession();
  const topics = useTopics();
  const keys = useLive(session.admin ? `topicKeys/${id}` : null, (v) => (v ?? {}) as Record<string, string>);
  const [lesson, setLesson] = useState(false);
  const [space, setSpace] = useState<Space>('small');
  const [columns, setColumns] = useState(false);
  const [answers, setAnswers] = useState(true);
  const [solutions, setSolutions] = useState(false);
  // Pictures still loading: printing waits for none.
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const track = (iid: string, done: boolean) =>
    setLoading((s) => {
      if (done ? !s.has(iid) : s.has(iid)) return s;
      const n = new Set(s);
      if (done) n.delete(iid);
      else n.add(iid);
      return n;
    });

  if (!session.ready || !topics) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.admin) return <LockedNote title="Зөвхөн багш хэвлэнэ" />;
  const t = topics.find((x) => x.id === id);
  if (!t) return <CenterNote title="Ийм сэдэв олдсонгүй" />;
  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-blue-500" /> {label}
    </label>
  );

  return (
    <div className="mx-auto max-w-[210mm] space-y-4">
      <div className="space-y-3 rounded-2xl bg-neutral-900 p-4 text-sm print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/admin/topic/${id}`} className="flex items-center gap-1 text-neutral-400 hover:text-neutral-200">
            <ArrowLeft size={16} /> Сэдэв
          </Link>
          <h1 className="mr-auto font-semibold">Дасгалын хуудас хэвлэх</h1>
          <button
            onClick={() => print()}
            disabled={loading.size > 0}
            className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 font-semibold text-black hover:bg-blue-400 disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            <Printer size={16} /> {loading.size ? `Зураг ачаалж байна (${loading.size})…` : 'Хэвлэх / PDF'}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-neutral-300">
          {t.lesson.length > 0 && toggle(lesson, setLesson, 'Хичээлийг оруулах')}
          {toggle(columns, setColumns, 'Хоёр баганаар')}
          {toggle(answers, setAnswers, 'Хариултын хуудас')}
          {answers && toggle(solutions, setSolutions, 'Бодолттой')}
          <span className="flex items-center gap-2">
            Бодох зай:
            <span className="flex rounded-full bg-neutral-800 p-0.5" role="radiogroup" aria-label="Бодох зай">
              {SPACES.map(([s, label]) => (
                <button key={s} type="button" role="radio" aria-checked={space === s} onClick={() => setSpace(s)} className={`rounded-full px-2.5 py-0.5 ${space === s ? 'bg-neutral-600 text-neutral-50' : 'text-neutral-400'}`}>
                  {label}
                </button>
              ))}
            </span>
          </span>
        </div>
        <p className="text-xs text-neutral-500">«Хэвлэх / PDF» дараад хэвлэгч эсвэл «PDF болгон хадгалах»-ыг сонгоно. Хариултын хуудас тусдаа хуудсанд гарна.</p>
      </div>

      {/* The paper: white and black in either look, as it prints. */}
      <article className="bg-white px-8 py-8 text-black shadow-lg print:px-0 print:py-0 print:shadow-none" aria-label="Дасгалын хуудас">
        <header className="border-b-2 border-black pb-3">
          <h2 className="text-2xl font-bold">{t.title}</h2>
          {t.intro && <p className="mt-1 text-sm">{t.intro}</p>}
          <p className="mt-4 grid grid-cols-[2fr_1fr_1fr] gap-4 text-sm">
            <span>Нэр: ______________________</span>
            <span>Анги: _________</span>
            <span>Огноо: _________</span>
          </p>
        </header>
        {lesson && t.lesson.length > 0 && (
          <section className="mt-5 space-y-3 border-b border-black/30 pb-5">
            {t.lesson.map((b, i) => (b.t === 'text' ? <Rich key={i} text={b.text} className="text-[15px]" /> : b.t === 'img' ? <Picture key={i} tid={t.id} iid={b.img} onState={track} /> : null))}
          </section>
        )}
        <ol className={`mt-5 ${columns ? 'columns-2 gap-8' : ''}`}>
          {t.problems.map((p, i) => (
            <li key={p.id} className="mb-6 break-inside-avoid">
              <div className="flex gap-2">
                <span className="shrink-0 font-bold">{problemNo(p, i)}.</span>
                <div className="min-w-0 flex-1 space-y-2">
                  {p.text && <Rich text={p.text} />}
                  {p.img && <Picture tid={t.id} iid={p.img} onState={track} />}
                  <Choices p={p} />
                  {p.kind === 'answer' && <p className="pt-1 text-sm">Хариулт: ______________________</p>}
                  {space !== 'none' && <div className={SPACE[space]} aria-hidden />}
                </div>
              </div>
            </li>
          ))}
        </ol>
        {answers && (
          <section className="mt-8 break-before-page border-t-2 border-black pt-4 print:mt-0 print:border-t-0 print:pt-0">
            <h3 className="text-xl font-bold">{t.title} — хариулт</h3>
            <ol className={`mt-3 ${solutions ? 'space-y-3' : 'grid grid-cols-4 gap-x-6 gap-y-1 sm:grid-cols-6'}`}>
              {t.problems.map((p, i) => {
                const k = keys?.[p.id];
                const shown = k ? (p.kind === 'choice' ? (LETTER_LABELS[k as Letter] ?? k) : k) : '—';
                return (
                  <li key={p.id} className="break-inside-avoid text-sm">
                    <span className="font-semibold">{problemNo(p, i)}.</span> {shown}
                    {solutions && (p.sol || p.solImg) && (
                      <div className="mt-1 space-y-1 pl-5">
                        {p.sol && <Rich text={p.sol} className="text-sm" />}
                        {p.solImg && <Picture tid={t.id} iid={p.solImg} onState={track} small />}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            {t.problems.some((p) => !keys?.[p.id]) && <p className="mt-3 text-xs">«—»: зөв хариулт оруулаагүй (багш шалгана).</p>}
          </section>
        )}
      </article>
    </div>
  );
}

/** А–Д with their texts; when the picture shows them, only the letters to circle. */
function Choices({p}: {p: Problem}) {
  if (p.kind !== 'choice') return null;
  const texts = LETTER_CODES.map((l) => p.choices?.[l]?.trim());
  if (!texts.some(Boolean))
    return (
      <p className="flex gap-4 pt-1 text-sm font-semibold">
        {LETTER_CODES.map((l) => (
          <span key={l} className="flex h-6 w-6 items-center justify-center rounded-full border border-black">
            {LETTER_LABELS[l]}
          </span>
        ))}
      </p>
    );
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-1 pt-1 text-sm sm:grid-cols-3">
      {LETTER_CODES.map((l, j) => (
        <li key={l}>
          <span className="font-semibold">{LETTER_LABELS[l]})</span> {texts[j] ? <Rich text={texts[j]!} className="inline-block" /> : null}
        </li>
      ))}
    </ul>
  );
}

/** A picture as printed (no zoom, no grey box): `onState` hears when it is loading and when it is in. */
function Picture({tid, iid, onState, small}: {tid: string; iid: string; onState: (iid: string, done: boolean) => void; small?: boolean}) {
  const url = useTopicImage(tid, iid);
  useEffect(() => {
    onState(iid, url !== undefined);
    return () => onState(iid, true);
    // `onState` is the page's; a new one each render needs no new report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iid, url]);
  if (!url) return null;
  return <img src={url} alt="" className={`mx-auto w-auto max-w-full object-contain ${small ? 'max-h-40' : 'max-h-72'}`} />;
}
