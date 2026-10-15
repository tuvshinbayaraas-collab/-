import {ArrowLeft} from 'lucide-react';
import {useEffect, useState} from 'react';
import {CenterNote, LockedNote} from '../components/Notices';
import QuestionCard from '../components/QuestionCard';
import {QuestionList} from '../components/QuestionList';
import {formatDuration} from '../lib/attempt';
import {choiceAt, grade, percent, useKeys} from '../lib/keys';
import {asResult, useExamAnswer, useExams} from '../lib/exams';
import {formatDate, useResult} from '../lib/results';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {useNow} from '../lib/time';
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
  const now = useNow(isExam ? 5000 : 0);
  const result = isExam ? (examAnswer === undefined ? undefined : examAnswer && uid ? asResult(testId, uid, examAnswer) : null) : practice;
  // A practice result's key is readable for whoever handed it in; an exam's only once the exam is over.
  const keyReadable = !!uid && result !== null && (!isExam || (!!result && (session.admin || (!!exam && now > exam.end))));
  const keys = useKeys(keyReadable ? [testId] : []);
  const [test, setTest] = useState<Test | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const info = testInfo(testId);

  useEffect(() => {
    loadTest(testId)?.then(setTest);
  }, [testId]);

  if (!info) return <CenterNote title="Ийм тест олдсонгүй" />;
  if (session.ready && !session.user) return <LockedNote />;
  if (!session.ready || result === undefined || !test) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!result) return <CenterNote title="Энэ дүн олдсонгүй" />;
  if (isExam && !session.admin && exam && now <= exam.end) return <CenterNote title="Шалгалтын дүн шалгалт дууссаны дараа гарна" />;

  const key = keys[testId];
  const g = grade(result.answers, key, test.questions.length);
  const back = other ? `/admin/student/${other}` : '/results';
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
          {!!examAnswer?.leaves && ` • хуудаснаас ${examAnswer.leaves} удаа гарсан`}
          {!isExam && !!result.leaves && ` • хуудаснаас ${result.leaves} удаа гарсан`}
        </p>
        {key === undefined ? (
          <p className="mt-2 text-neutral-400">Ачаалж байна…</p>
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
            <button onClick={() => setOnlyWrong((o) => !o)} aria-pressed={onlyWrong} className="rounded-full bg-neutral-800 px-3.5 py-1 text-sm font-medium hover:bg-neutral-700">
              {onlyWrong ? 'Бүх бодлогыг харах' : 'Зөвхөн алдсанаа харах'}
            </button>
          </div>
        )}
        <p className="mt-2 text-sm text-neutral-500">
          Бодлогууд номын дарааллаар харагдаж байна.
        </p>
      </div>
      <QuestionList>
        {test.questions.map((q, i) =>
          onlyWrong && !missed.includes(i) ? null : (
            <QuestionCard key={i} num={i + 1} q={q} chosen={choiceAt(result.answers, i)} checked correct={correctAt(i)} reveal={reveal} />
          ),
        )}
      </QuestionList>
    </div>
  );
}
