import {ArrowLeft} from 'lucide-react';
import {useEffect, useState} from 'react';
import {CenterNote, LockedNote} from '../components/Notices';
import QuestionCard from '../components/QuestionCard';
import {formatTime} from '../lib/attempt';
import {choiceAt, grade, percent, useKeys} from '../lib/keys';
import {formatDate, useResult} from '../lib/results';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {loadTest, testInfo} from '../tests';
import type {Test} from '../tests/types';

/** A handed-in test in book order: /review/{test}/{resultId}, or ?u={uid} for the teacher looking at a student's. */
export default function Review({test: testId, id, uid: other}: {test: string; id: string; uid?: string}) {
  const session = useSession();
  const uid = other ?? session.user?.uid;
  const result = useResult(session.ready ? uid : undefined, testId, id);
  const keys = useKeys(result ? [testId] : []);
  const [test, setTest] = useState<Test | null>(null);
  const info = testInfo(testId);

  useEffect(() => {
    loadTest(testId)?.then(setTest);
  }, [testId]);

  if (!info) return <CenterNote title="Ийм тест олдсонгүй" />;
  if (session.ready && !session.user) return <LockedNote />;
  if (!session.ready || result === undefined || !test) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!result) return <CenterNote title="Энэ дүн олдсонгүй" />;

  const key = keys[testId];
  const g = grade(result.answers, key, test.questions.length);
  const back = other ? `/admin/student/${other}` : '/results';

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={16} /> Буцах
      </Link>
      <div className="mt-2 rounded-2xl bg-neutral-900 p-5">
        <h1 className="text-xl font-bold">{test.title}</h1>
        <p className="text-sm text-neutral-400">
          {formatDate(result.at)} • {formatTime(result.seconds)}
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
        <p className="mt-2 text-sm text-neutral-500">Бодлогууд номын дарааллаар харагдаж байна.</p>
      </div>
      <ol className="mt-4 space-y-4">
        {test.questions.map((q, i) => (
          <QuestionCard key={i} num={i + 1} q={q} chosen={choiceAt(result.answers, i)} checked correct={g ? choiceAt(key, i) : null} />
        ))}
      </ol>
    </div>
  );
}
