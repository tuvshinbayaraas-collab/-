import {ChevronDown, Eraser, MessageCircleQuestion, Send, Trash2} from 'lucide-react';
import {useEffect, useState} from 'react';
import {ref, update} from 'firebase/database';
import {deleteQuestion, replyQuestion, useAllQuestions, type Question} from '../../lib/classroom';
import {db} from '../../lib/firebase';
import {choiceAt} from '../../lib/keys';
import {useLive} from '../../lib/live';
import {formatDate} from '../../lib/results';
import {Link} from '../../lib/router';
import {LETTER_CODES, LETTER_LABELS, readKey, useTopics, type Letter} from '../../lib/topics';
import {loadTest} from '../../tests';
import type {Test} from '../../tests/types';
import MathText from '../../components/MathText';
import QuestionCard from '../../components/QuestionCard';
import {Rich, TopicPicture} from '../../components/TopicParts';
import type {AdminData} from './data';
import Loading from '../../components/Loading';

type Show = 'all' | 'open' | 'answered';

/**
 * Students' questions about problems: unanswered first; the answer shows on the student's "Асуултууд" page. Each can
 * open the problem it is about (with the student's answer); answered ones can be deleted, one by one or all those the
 * student has read at once.
 */
export default function QuestionsTab({data}: {data: AdminData}) {
  const all = useAllQuestions();
  const [show, setShow] = useState<Show>('all');
  const [clearing, setClearing] = useState(false);
  if (!all) return <Loading small />;
  const names = new Map(data.students.map((s) => [s.uid, s.profile.name]));
  const list = all.filter((q) => names.has(q.uid));
  const open = list.filter((q) => !q.reply).length;
  const read = list.filter((q) => q.reply && q.seen);
  const shown = list.filter((q) => (show === 'open' ? !q.reply : show === 'answered' ? !!q.reply : true));
  const clear = async () => {
    if (!confirm(`Сурагч хариуг нь уншсан ${read.length} асуултыг устгах уу?`)) return;
    setClearing(true);
    try {
      await update(ref(db), Object.fromEntries(read.map((q) => [`questions/${q.uid}/${q.id}`, null])));
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
    } finally {
      setClearing(false);
    }
  };
  const chip = (s: Show, label: string, n: number) => (
    <button
      key={s}
      type="button"
      onClick={() => setShow(s)}
      aria-pressed={show === s}
      className={`rounded-full px-3 py-1 text-sm ${show === s ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
    >
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );
  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageCircleQuestion size={18} className="text-sky-300" /> Сурагчдын асуулт
          {open > 0 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">{open} хариулаагүй</span>}
        </h2>
        <p className="text-sm text-neutral-400">Сурагчид бодлого бүрийн доорх «Багшаас асуух» товчоор асууна. Хариулахад сурагчийн нүүр хуудсанд мэдэгдэл гарна.</p>
      </div>
      {list.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Шүүх">
          {chip('all', 'Бүгд', list.length)}
          {chip('open', 'Хариулаагүй', open)}
          {chip('answered', 'Хариулсан', list.length - open)}
          {read.length > 0 && (
            <button
              type="button"
              onClick={clear}
              disabled={clearing}
              className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-red-400 disabled:opacity-50"
              title="Хариуг нь сурагч уншсан асуултуудыг устгана"
            >
              <Eraser size={15} /> {clearing ? 'Устгаж байна…' : `Уншсан ${read.length}-ыг цэвэрлэх`}
            </button>
          )}
        </div>
      )}
      {!list.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Одоогоор асуулт алга.</p>
      ) : !shown.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">{show === 'open' ? 'Бүх асуултад хариулсан байна.' : 'Хариулсан асуулт алга.'}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((q) => (
            <Item key={`${q.uid}/${q.id}`} q={q} name={names.get(q.uid)!} data={data} />
          ))}
        </ul>
      )}
    </div>
  );
}

const remove = (q: Question) =>
  confirm(q.reply ? 'Энэ асуулт, таны хариуг устгах уу? Сурагчид ч харагдахгүй болно.' : 'Энэ асуултыг устгах уу?') && deleteQuestion(q.uid, q.id).catch((e) => alert(e.message));

function Item({q, name, data}: {q: Question; name: string; data: AdminData}) {
  const [text, setText] = useState(q.reply?.text ?? '');
  const [editing, setEditing] = useState(!q.reply);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await replyQuestion(q.uid, q.id, text);
      setEditing(false);
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const where = q.ctx.s === 'p' ? `/topics/${q.ctx.t}` : `/admin?tab=keys&test=${q.ctx.t}`;
  const del = (
    <button onClick={() => remove(q)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-800 hover:text-red-400">
      <Trash2 size={14} /> Устгах
    </button>
  );
  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 ${!q.reply ? 'ring-1 ring-sky-400/40' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
        <Link href={`/admin/student/${q.uid}`} className="font-semibold hover:underline">
          {name}
        </Link>
        <span className="text-neutral-600">·</span>
        <Link href={where} className="min-w-0 truncate text-blue-300 hover:underline">
          {q.ctx.label}
        </Link>
        <span className="ml-auto text-xs text-neutral-500">{formatDate(q.at)}</span>
      </div>
      <Rich text={q.text} className="mt-2" />
      {q.ctx.q !== undefined && (
        <button type="button" onClick={() => setProblem((x) => !x)} aria-expanded={problem} className="mt-2 flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200">
          <ChevronDown size={14} className={`transition-transform ${problem ? 'rotate-180' : ''}`} /> {problem ? 'Бодлогыг нуух' : 'Бодлогыг харах'}
        </button>
      )}
      {problem && <ProblemPreview q={q} data={data} />}
      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            maxLength={1000}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            placeholder="Хариулт… (томьёо: $2^3 = 8$)"
            className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={send}
              disabled={busy || !text.trim()}
              className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
            >
              <Send size={15} /> {busy ? 'Илгээж байна…' : 'Хариулах'}
            </button>
            {q.reply && (
              <button onClick={() => setEditing(false)} className="rounded-full bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700">
                Болих
              </button>
            )}
            <span className="ml-auto">{del}</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-sky-500/10 p-3 text-sm">
          <p className="text-xs font-semibold text-sky-300">
            Таны хариу · {formatDate(q.reply!.at)} {q.seen ? '· сурагч уншсан' : ''}
          </p>
          <Rich text={q.reply!.text} className="mt-1" />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
              Засах
            </button>
            <span className="ml-auto">{del}</span>
          </div>
        </div>
      )}
    </li>
  );
}

/** The problem a question is about, with what the student answered and the right answer (the teacher may see it). */
function ProblemPreview({q, data}: {q: Question; data: AdminData}) {
  return <div className="mt-2 rounded-xl border border-neutral-800 bg-neutral-950/40 p-2">{q.ctx.s === 't' ? <TestProblem q={q} data={data} /> : <TopicProblem q={q} />}</div>;
}

function TestProblem({q, data}: {q: Question; data: AdminData}) {
  const [test, setTest] = useState<Test | null | undefined>(undefined);
  useEffect(() => {
    const p = loadTest(q.ctx.t);
    if (!p) return setTest(null);
    p.then(setTest, () => setTest(null));
  }, [q.ctx.t]);
  const qi = Number(q.ctx.q);
  if (test === undefined) return <p className="p-2 text-sm text-neutral-500">Ачаалж байна…</p>;
  const question = test?.questions[qi];
  if (!question) return <p className="p-2 text-sm text-neutral-500">Энэ бодлого олдсонгүй.</p>;
  // The student's latest answer to it (results are newest first), and the key's.
  const last = data.results.find((r) => r.uid === q.uid && r.test === q.ctx.t);
  const chosen = last ? choiceAt(last.answers, qi) : null;
  const correct = data.keys[q.ctx.t] ? choiceAt(data.keys[q.ctx.t], qi) : null;
  return (
    <>
      <ol>
        <QuestionCard num={qi + 1} q={question} chosen={chosen} checked={chosen !== null} correct={correct} reveal whose="Сурагчийн" />
      </ol>
      <p className="px-2 pb-1 text-xs text-neutral-400">{chosen === null ? 'Сурагч энэ бодлогод хариулаагүй.' : 'Сурагчийн сүүлийн оролдлогын хариулт тэмдэглэгдсэн.'}</p>
    </>
  );
}

function TopicProblem({q}: {q: Question}) {
  const topics = useTopics();
  // '' when the student hasn't answered it (null while it loads).
  const mine = useLive(`topicProgress/${q.uid}/${q.ctx.t}/${q.ctx.q}`, (v) => {
    const a = (v as {a?: unknown} | null)?.a;
    return typeof a === 'string' ? a : '';
  });
  const [key, setKey] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    readKey(q.ctx.t, q.ctx.q!).then(setKey, () => setKey(null));
  }, [q.ctx.t, q.ctx.q]);
  if (!topics) return <p className="p-2 text-sm text-neutral-500">Ачаалж байна…</p>;
  const p = topics.find((t) => t.id === q.ctx.t)?.problems.find((x) => x.id === q.ctx.q);
  if (!p) return <p className="p-2 text-sm text-neutral-500">Энэ бодлого олдсонгүй (устгагдсан байж магадгүй).</p>;
  const shown = (a: string | null | undefined) => (a ? (p.kind === 'choice' ? (LETTER_LABELS[a as Letter] ?? a) : a) : '—');
  return (
    <div className="space-y-2 p-2">
      {p.text && <Rich text={p.text} />}
      {p.img && <TopicPicture tid={q.ctx.t} iid={p.img} className="w-full" trim />}
      {p.kind === 'choice' && p.choices && (
        <div className="flex flex-wrap gap-1.5">
          {LETTER_CODES.filter((l) => p.choices?.[l]).map((l) => (
            <span key={l} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm ${l === key ? 'border-green-500/70' : l === mine ? 'border-red-500/70' : 'border-neutral-800'}`}>
              <b className="text-xs text-neutral-400">{LETTER_LABELS[l]}</b>
              <MathText text={p.choices![l]!} display />
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-neutral-400">
        Сурагчийн хариулт: <b className="text-neutral-200">{mine === null ? '…' : shown(mine)}</b>
        {' · '}Зөв хариулт: <b className="text-neutral-200">{key === undefined ? '…' : key ? shown(key) : 'оруулаагүй (та шалгана)'}</b>
      </p>
    </div>
  );
}
