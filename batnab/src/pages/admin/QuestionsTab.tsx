import {ChevronDown, ChevronRight, Eraser, MessageCircleQuestion, Send, Trash2, Users} from 'lucide-react';
import {useEffect, useState} from 'react';
import {deleteQuestion, deleteQuestions, replyQuestion, replyQuestions, useAllQuestions, type Question} from '../../lib/classroom';
import {choiceAt} from '../../lib/keys';
import {useLive} from '../../lib/live';
import {formatDate} from '../../lib/results';
import {Link} from '../../lib/router';
import {problemHref} from '../../components/AskedProblem';
import {LETTER_CODES, LETTER_LABELS, readKey, useAllProgress, useTopics, type Letter} from '../../lib/topics';
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
 * student has read at once. Several students asking about the same problem come together: one answer to all of them
 * (or the ones ticked), and deleted together.
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
      await deleteQuestions(read);
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
          {groups(shown).map((qs) =>
            qs.length > 1 ? (
              <Group key={`g:${about(qs[0])}`} qs={qs} names={names} data={data} />
            ) : (
              <Item key={`${qs[0].uid}/${qs[0].id}`} q={qs[0]} name={names.get(qs[0].uid)!} data={data} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/** The problem a question is about. */
const about = (q: Question) => `${q.ctx.s}/${q.ctx.t}/${q.ctx.q ?? ''}`;
/** The questions by the problem they are about, in the order the first of each comes (unanswered first, newest). */
function groups(qs: Question[]) {
  const by = new Map<string, Question[]>();
  for (const q of qs) by.set(about(q), [...(by.get(about(q)) ?? []), q]);
  return [...by.values()];
}
const idOf = (q: Question) => `${q.uid}/${q.id}`;

/** Several students' questions about one problem: one answer to the ones ticked (the unanswered, to start with), or deleted together. */
function Group({qs, names, data}: {qs: Question[]; names: Map<string, string>; data: AdminData}) {
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const open = qs.filter((q) => !q.reply);
  // The problem shows while some wait for an answer (the teacher answers looking at it).
  const [problem, setProblem] = useState(open.length > 0);
  // Until the teacher ticks: the unanswered ones (or, all answered, every one).
  const picked = ticked ?? new Set((open.length ? open : qs).map(idOf));
  const chosen = qs.filter((q) => picked.has(idOf(q)));
  const tick = (q: Question) => {
    const next = new Set(picked);
    if (!next.delete(idOf(q))) next.add(idOf(q));
    setTicked(next);
  };
  const first = qs[0];
  const where = first.ctx.s === 'p' ? problemHref(first.ctx)! : `/admin?tab=keys&test=${first.ctx.t}`;
  // What each one answered to the problem: a test's last attempt, a topic's first answer.
  const progress = useAllProgress(first.ctx.s === 'p');
  const answerOf = (q: Question) => {
    if (q.ctx.s === 't') {
      const r = data.results.find((x) => x.uid === q.uid && x.test === q.ctx.t);
      const c = r ? choiceAt(r.answers, Number(q.ctx.q)) : null;
      return c === null ? null : LETTER_LABELS[LETTER_CODES[c]];
    }
    const a = progress?.[q.uid]?.[q.ctx.t]?.[q.ctx.q ?? '']?.a;
    return a ? (LETTER_LABELS[a as Letter] ?? a) : null;
  };
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await f();
      setTicked(null);
      return true;
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const answer = async () => {
    if (await run(() => replyQuestions(chosen, text))) setText('');
  };
  const drop = () => confirm(`Сонгосон ${chosen.length} сурагчийн асуулт (таны хариутай нь) устгах уу? Тэдэнд ч харагдахгүй болно.`) && void run(() => deleteQuestions(chosen));
  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 ${open.length ? 'ring-1 ring-sky-400/40' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Users size={16} className="shrink-0 text-sky-300" />
        <Link href={where} className="min-w-0 truncate font-semibold text-blue-300 hover:underline">
          {first.ctx.label}
        </Link>
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200">
          {qs.length} сурагч асуусан{open.length ? ` · ${open.length} хариулаагүй` : ''}
        </span>
      </div>
      {first.ctx.q !== undefined && (
        <button type="button" onClick={() => setProblem((x) => !x)} aria-expanded={problem} className="mt-2 flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200">
          <ChevronDown size={14} className={`transition-transform ${problem ? 'rotate-180' : ''}`} /> {problem ? 'Бодлогыг нуух' : 'Бодлогыг харах'}
        </button>
      )}
      {problem && <ProblemPreview q={first} data={data} mine={false} href={where} />}
      <ul className="mt-3 divide-y divide-neutral-800 rounded-xl border border-neutral-800">
        {qs.map((q) => {
          const a = answerOf(q);
          return (
            <li key={idOf(q)}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-neutral-800/40">
                <input type="checkbox" checked={picked.has(idOf(q))} onChange={() => tick(q)} className="mt-1 h-4 w-4 shrink-0 accent-blue-500" aria-label={`${names.get(q.uid)} сонгох`} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Link href={`/admin/student/${q.uid}`} className="font-semibold hover:underline">
                      {names.get(q.uid)}
                    </Link>
                    {a && <span className="text-xs text-neutral-500">хариулт: {a}</span>}
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${q.reply ? 'bg-green-500/15 text-green-300' : 'bg-sky-500/15 text-sky-200'}`}>{q.reply ? (q.seen ? 'хариулсан · уншсан' : 'хариулсан') : 'хариулаагүй'}</span>
                    <span className="ml-auto text-xs text-neutral-500">{formatDate(q.at)}</span>
                  </span>
                  <Rich text={q.text} className="mt-1" />
                  {q.reply && <span className="mt-1 block text-xs text-sky-300/90 [overflow-wrap:anywhere]">Таны хариу: {q.reply.text}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <button type="button" onClick={() => setTicked(new Set(chosen.length === qs.length ? [] : qs.map(idOf)))} className="rounded-full px-2.5 py-1 hover:bg-neutral-800 hover:text-neutral-200">
          {chosen.length === qs.length ? 'Бүгдийг цуцлах' : 'Бүгдийг сонгох'}
        </button>
        <span>{chosen.length} сонгосон</span>
      </div>
      <div className="mt-2 space-y-2">
        <textarea
          value={text}
          maxLength={1000}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Сонгосон ${chosen.length} сурагчид нэг хариулт… (томьёо: $2^3 = 8$)`}
          aria-label="Нэг хариулт"
          className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={answer} disabled={busy || !text.trim() || !chosen.length} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
            <Send size={15} /> {busy ? 'Илгээж байна…' : `${chosen.length} сурагчид хариулах`}
          </button>
          <button onClick={drop} disabled={busy || !chosen.length} className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-800 hover:text-red-400 disabled:opacity-50">
            <Trash2 size={14} /> Сонгосон {chosen.length}-ийг устгах
          </button>
        </div>
      </div>
    </li>
  );
}

const remove = (q: Question) =>
  confirm(q.reply ? 'Энэ асуулт, таны хариуг устгах уу? Сурагчид ч харагдахгүй болно.' : 'Энэ асуултыг устгах уу?') && deleteQuestion(q).catch((e) => alert(e.message));

function Item({q, name, data}: {q: Question; name: string; data: AdminData}) {
  const [text, setText] = useState(q.reply?.text ?? '');
  const [editing, setEditing] = useState(!q.reply);
  const [busy, setBusy] = useState(false);
  // The problem shows until it is answered (the teacher answers looking at it).
  const [problem, setProblem] = useState(!q.reply);
  const send = async () => {
    setBusy(true);
    try {
      await replyQuestion(q, text);
      setEditing(false);
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  // The problem itself: a topic's on its page, a test's in this student's latest attempt (else the key's page).
  const where = problemHref(q.ctx, data.results.filter((r) => r.uid === q.uid), q.uid) ?? `/admin?tab=keys&test=${q.ctx.t}`;
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
      {q.peer && (
        <div className="mt-2 rounded-xl bg-teal-500/10 p-3 text-sm">
          <p className="text-xs font-semibold text-teal-300">
            Ангийн дарга {q.peer.name}-ийн тайлбар · {formatDate(q.peer.at)}
          </p>
          <Rich text={q.peer.text} className="mt-1" />
        </div>
      )}
      {q.ctx.q !== undefined && (
        <button type="button" onClick={() => setProblem((x) => !x)} aria-expanded={problem} className="mt-2 flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200">
          <ChevronDown size={14} className={`transition-transform ${problem ? 'rotate-180' : ''}`} /> {problem ? 'Бодлогыг нуух' : 'Бодлогыг харах'}
        </button>
      )}
      {problem && <ProblemPreview q={q} data={data} href={where} />}
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
function ProblemPreview({q, data, mine = true, href}: {q: Question; data: AdminData; mine?: boolean; href?: string}) {
  return (
    <div className="mt-2 rounded-xl border border-neutral-800 bg-neutral-950/40 p-2">
      {q.ctx.s === 't' ? <TestProblem q={q} data={data} mine={mine} /> : <TopicProblem q={q} mine={mine} />}
      {href && (
        <Link href={href} className="mx-2 mb-1 inline-flex items-center gap-0.5 text-xs font-semibold text-sky-300 hover:underline">
          Бодлого руу очих <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function TestProblem({q, data, mine}: {q: Question; data: AdminData; mine: boolean}) {
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
  const last = mine ? data.results.find((r) => r.uid === q.uid && r.test === q.ctx.t) : undefined;
  const chosen = last ? choiceAt(last.answers, qi) : null;
  const correct = data.keys[q.ctx.t] ? choiceAt(data.keys[q.ctx.t], qi) : null;
  return (
    <>
      <ol>
        <QuestionCard num={qi + 1} q={question} chosen={chosen} checked={chosen !== null} correct={correct} reveal whose="Сурагчийн" />
      </ol>
      {mine && <p className="px-2 pb-1 text-xs text-neutral-400">{chosen === null ? 'Сурагч энэ бодлогод хариулаагүй.' : 'Сурагчийн сүүлийн оролдлогын хариулт тэмдэглэгдсэн.'}</p>}
    </>
  );
}

function TopicProblem({q, mine: withMine}: {q: Question; mine: boolean}) {
  const topics = useTopics();
  // '' when the student hasn't answered it (null while it loads).
  const mine = useLive(withMine ? `topicProgress/${q.uid}/${q.ctx.t}/${q.ctx.q}` : null, (v) => {
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
        {withMine && (
          <>
            Сурагчийн хариулт: <b className="text-neutral-200">{mine === null ? '…' : shown(mine)}</b>
            {' · '}
          </>
        )}
        Зөв хариулт: <b className="text-neutral-200">{key === undefined ? '…' : key ? shown(key) : 'оруулаагүй (та шалгана)'}</b>
      </p>
    </div>
  );
}
