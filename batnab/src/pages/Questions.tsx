import {MessageCircleQuestion, Trash2} from 'lucide-react';
import {useEffect} from 'react';
import {InactiveNote, LockedNote} from '../components/Notices';
import {Rich} from '../components/TopicParts';
import {deleteQuestion, markSeen, useMyQuestions, type Question} from '../lib/classroom';
import {formatDate} from '../lib/results';
import {Link} from '../lib/router';
import {isStudent, useSession} from '../lib/session';

/** Where a question was asked from, as a link back to it. */
export const questionHref = (q: Question) => (q.ctx.s === 'p' ? `/topics/${q.ctx.t}` : '/mistakes');

/** /questions: the student's questions to the teacher and the answers; opening the page marks answers as read. */
export default function Questions() {
  const session = useSession();
  const uid = isStudent(session) ? session.user!.uid : undefined;
  const questions = useMyQuestions(uid);
  useEffect(() => {
    for (const q of questions ?? []) if (q.reply && !q.seen) markSeen(q.uid, q.id).catch(() => {});
  }, [questions]);

  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote text="Асуултаа харахын тулд нэвтэрнэ үү." />;
  if (!uid) return session.admin ? <p className="py-24 text-center text-neutral-400">Сурагчдын асуулт багшийн самбарын «Асуулт» хэсэгт байна.</p> : <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!questions) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
          <MessageCircleQuestion size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Миний асуултууд</h1>
          <p className="text-sm text-neutral-400">Бодлого бүрийн доорх «Багшаас асуух» товчоор асууна. Багшийн хариу энд гарна.</p>
        </div>
      </header>
      {!questions.length ? (
        <p className="mt-6 rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">Одоогоор асуулт асуугаагүй байна.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {questions.map((q) => (
            <li key={q.id} className={`rounded-2xl bg-neutral-900 p-4 ${q.reply && !q.seen ? 'ring-1 ring-sky-400/50' : ''}`}>
              <div className="flex items-start gap-2">
                <Link href={questionHref(q)} className="min-w-0 flex-1 text-sm font-medium text-blue-300 hover:underline">
                  {q.ctx.label}
                </Link>
                <span className="shrink-0 text-xs text-neutral-500">{formatDate(q.at)}</span>
              </div>
              <Rich text={q.text} className="mt-2 text-neutral-100" />
              {q.reply ? (
                <div className="mt-3 rounded-xl bg-sky-500/10 p-3">
                  <p className="text-xs font-semibold text-sky-300">Багшийн хариу · {formatDate(q.reply.at)}</p>
                  <Rich text={q.reply.text} className="mt-1 text-sm text-neutral-100" />
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-neutral-500">Хариу хүлээж байна…</span>
                  <button onClick={() => confirm('Энэ асуултыг буцааж авах уу?') && deleteQuestion(q.uid, q.id).catch(() => {})} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800">
                    <Trash2 size={13} /> Буцааж авах
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
