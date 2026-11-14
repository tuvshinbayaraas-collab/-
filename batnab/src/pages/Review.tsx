import {ArrowLeft} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import Loading from '../components/Loading';
import {CenterNote, LockedNote} from '../components/Notices';
import {isPerfect, PerfectBadge, perfectText} from '../components/Perfect';
import AskButton from '../components/Ask';
import ReportButton, {useCanReport} from '../components/ReportMistake';
import QuestionCard from '../components/QuestionCard';
import {QuestionList} from '../components/QuestionList';
import SkillBreakdown from '../components/SkillBreakdown';
import {formatDuration} from '../lib/attempt';
import {choiceAt, grade, percent, useKeys} from '../lib/keys';
import {asResult, awayTimes, awayTotal, useExamAnswer, useExamEvents, useExams} from '../lib/exams';
import AwayList from '../components/AwayList';
import {formatDate, useResult} from '../lib/results';
import {focusOn} from '../lib/focus';
import {Link, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {skillStats} from '../lib/skills';
import {useNow} from '../lib/time';
import {skillOf, type Skill} from '../tests/skills';
import {loadTest, testInfo} from '../tests';
import type {Test} from '../tests/types';

/**
 * A handed-in test in book order: /review/{test}/{resultId}, /review/{test}/exam for the scheduled exam, or ?u={uid}
 * for the teacher looking at a student's.
 */
export default function Review({test: testId, id, uid: other}: {test: string; id: string; uid?: string}) {
  const session = useSession();
  const uid = other ?? session.user?.uid;
  const isExam = id === 'exam';
  // The answers and the key are read together as soon as the account is known (not one after the other).
  const practice = useResult(!isExam ? uid : undefined, testId, id);
  const examAnswer = useExamAnswer(testId, isExam ? uid : undefined);
  const exam = useExams()?.[testId];
  // When and how long they were away: the teacher's to see (counted quietly, as in a practice test).
  const events = useExamEvents(isExam && uid && session.admin ? testId : null, uid);
  const times = uid ? awayTimes(events?.[uid] ?? []) : [];
  const now = useNow(isExam ? 5000 : 0);
  const result = isExam ? (examAnswer === undefined ? undefined : examAnswer && uid ? asResult(testId, uid, examAnswer) : null) : practice;
  // A practice result's key is readable for whoever handed it in; an exam's only once the exam is over.
  const keyReadable = !!uid && result !== null && (!isExam || (!!result && (session.admin || (!!exam && now > exam.end))));
  const keys = useKeys(keyReadable ? [testId] : []);
  const [test, setTest] = useState<Test | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const info = testInfo(testId);

  // Opened at one question (?q=<index>, e.g. from a question about it): every card laid out, so it lands on it.
  const focus = useLocation().query.get('q');
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (focus === null || focused.current === focus || !test || !result) return;
    const el = document.getElementById(`q${Number(focus) + 1}`);
    if (!el) return;
    focused.current = focus;
    focusOn(el);
  });
  // A class leader can report a mistake in any of its questions.
  const canReport = useCanReport();
  const [failed, setFailed] = useState(false);
  const [skill, setSkill] = useState<Skill | null>(null);
  useEffect(() => {
    loadTest(testId)?.then(setTest, () => setFailed(true));
  }, [testId]);

  if (!info) return <CenterNote title="Ийм тест олдсонгүй" />;
  if (session.ready && !session.user) return <LockedNote />;
  if (failed)
    return (
      <CenterNote title="Тестийг ачаалж чадсангүй">
        <button onClick={() => location.reload()} className="mt-2 rounded-full bg-blue-500 px-5 py-2 font-semibold text-black hover:bg-blue-400">
          Дахин оролдох
        </button>
      </CenterNote>
    );
  if (!session.ready || result === undefined || !test) return <Loading what="Хариултыг ачаалж байна…" />;
  if (!result) return <CenterNote title="Энэ дүн олдсонгүй" />;
  if (isExam && !session.admin && exam && now <= exam.end) return <CenterNote title="Шалгалтын дүн шалгалт дууссаны дараа гарна" />;

  const key = keys[testId];
  const g = grade(result.answers, key, test.questions.length);
  const back = other ? `/admin/student/${other}` : '/results';
  // Handed in, the exam over, or still on: until then a time away not come back from counts.
  const until = examAnswer?.done ? examAnswer.at : exam && now > exam.end ? exam.end : undefined;
  const away = awayTotal(examAnswer, times, until ?? now);
  // Only the teacher sees the right answers; a student sees which questions they missed.
  const reveal = session.admin;
  const correctAt = (i: number) => (g ? choiceAt(key, i) : null);
  const missed = test.questions.map((_, i) => i).filter((i) => correctAt(i) !== null && choiceAt(result.answers, i) !== correctAt(i));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={16} /> Буцах
      </Link>
      <div className="mt-2 rounded-2xl bg-neutral-900 p-5">
        <h1 className="text-xl font-bold">
          {isExam && 'Шалгалт: '}
          {test.title}
        </h1>
        <p className="text-sm text-neutral-400">
          {formatDate(result.at)} • {formatDuration(result.seconds)}
          {isExam && session.admin && away.leaves > 0 && ` • хуудаснаас ${away.leaves} удаа гарсан (нийт ${formatDuration(away.ms / 1000)})`}
          {/* Counted quietly: the teacher sees it, the student doesn't. */}
          {!isExam && session.admin && !!result.leaves && ` • хуудаснаас ${result.leaves} удаа гарсан${result.away ? ` (нийт ${formatDuration(result.away / 1000)})` : ''}`}
        </p>
        {times.length > 0 && (
          <details className="mt-2 rounded-xl bg-neutral-800/50 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-neutral-300">Хэзээ, хэр удаан гарсан</summary>
            <div className="mt-2">
              <AwayList times={times} now={now} until={until} />
            </div>
          </details>
        )}
        {key === undefined ? (
          <p className="mt-2 text-neutral-400">Ачаалж байна…</p>
        ) : g && isPerfect(g) ? (
          <div className="mt-2">
            <PerfectBadge kind={isExam ? 'exam' : 'test'} />
            <p className={`mt-1 text-3xl font-extrabold ${perfectText(isExam ? 'exam' : 'test')}`}>
              {g.score} <span className="text-xl">/ {g.total}</span>
              <span className="ml-3 text-lg">{percent(g)}%</span>
            </p>
          </div>
        ) : g ? (
          <p className="mt-2 text-3xl font-bold">
            {g.score} <span className="text-xl text-neutral-400">/ {g.total}</span>
            <span className="ml-3 text-lg text-neutral-300">{percent(g)}%</span>
          </p>
        ) : (
          <p className="mt-2 text-neutral-400">Багш энэ тестийн зөв хариултыг оруулаагүй байна.</p>
        )}
        {missed.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm">
              <span className="font-medium text-red-300">
                {missed.length} бодлого дээр алдсан{reveal ? '' : ':'}
              </span>{' '}
              {!reveal && <span className="text-neutral-400">{missed.map((i) => i + 1).join(', ')}</span>}
            </p>
            <button
              onClick={() => {
                setOnlyWrong((o) => !o);
                setSkill(null);
              }}
              aria-pressed={onlyWrong}
              className="rounded-full bg-neutral-800 px-3.5 py-1 text-sm font-medium hover:bg-neutral-700"
            >
              {onlyWrong ? 'Бүх бодлогыг харах' : 'Зөвхөн алдсанаа харах'}
            </button>
          </div>
        )}
        {g && (
          <SkillBreakdown
            stats={skillStats([{test: testId, answers: result.answers, key}])}
            percent={percent(g)}
            picked={skill}
            onPick={(s) => {
              setSkill(s);
              setOnlyWrong(false);
            }}
            notebook={!session.admin}
          />
        )}
        <p className="mt-2 text-sm text-neutral-500">Бодлогууд номын дарааллаар харагдаж байна.</p>
      </div>
      <QuestionList full={focus !== null}>
        {test.questions.map((q, i) =>
          (onlyWrong || skill) && (!missed.includes(i) || (skill && skillOf(testId, i) !== skill)) ? null : (
            <QuestionCard
              key={i}
              id={`q${i + 1}`}
              num={i + 1}
              q={q}
              chosen={choiceAt(result.answers, i)}
              checked
              correct={correctAt(i)}
              reveal={reveal}
              whose={other ? 'Сурагчийн' : 'Таны'}
              footer={
                !session.admin && !other && (canReport || missed.includes(i)) ? (
                  <span className="flex flex-wrap justify-end gap-1">
                    <ReportButton what={{kind: 'test', ref: testId, q: String(i + 1), label: `${test.title} · ${i + 1}-р бодлого`}} />
                    {missed.includes(i) && <AskButton ctx={{s: 't', t: testId, q: String(i), label: `${test.title} · ${i + 1}-р бодлого`}} />}
                  </span>
                ) : undefined
              }
            />
          ),
        )}
      </QuestionList>
    </div>
  );
}
