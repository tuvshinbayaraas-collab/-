import {BookOpen, ChevronRight, Image as ImageIcon, ListChecks} from 'lucide-react';
import {InactiveNote, LockedNote} from '../components/Notices';
import {useClasses} from '../lib/classes';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {forClassOf, useProgress, useTopics} from '../lib/topics';

/** /topics: the lessons and problems the teacher has opened for the student's class (the teacher sees drafts too). */
export default function Topics() {
  const session = useSession();
  const topics = useTopics();
  const progress = useProgress(session.user && !session.admin ? session.user.uid : undefined);
  const classes = useClasses();
  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote text="Сэдвүүдийг үзэхийн тулд нэвтэрнэ үү." />;
  if (!session.admin && (!session.profile || session.profile.disabled)) return <InactiveNote blocked={!!session.profile?.disabled} />;

  const shown = topics?.filter((t) => session.admin || forClassOf(t, session.profile?.class));
  const myClass = classes?.find((c) => c.id === session.profile?.class)?.name;
  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
          <BookOpen size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Сэдвүүд</h1>
          <p className="text-sm text-neutral-400">{session.admin ? 'Сурагчид ингэж харна. Засах бол багшийн самбарын «Сэдэв».' : `Хичээлээ уншаад бодлогоо бодоорой${myClass ? ` · ${myClass}` : ''}.`}</p>
        </div>
      </header>

      {!shown ? (
        <p className="py-16 text-center text-neutral-400">Ачаалж байна…</p>
      ) : !shown.length ? (
        <p className="mt-8 rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">Багш одоогоор сэдэв оруулаагүй байна.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((t) => {
            // Every problem can be done (one without a right answer goes to the teacher to check).
            const mine = progress?.[t.id] ?? {};
            const counted = t.problems;
            const done = counted.filter((p) => mine[p.id]).length;
            const total = counted.length;
            const pics = t.lesson.filter((b) => b.t === 'img').length;
            return (
              <li key={t.id}>
                <Link href={`/topics/${t.id}`} className="flex items-center gap-4 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800/70 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {t.title}
                      {!t.published && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">Ноорог</span>}
                      {!session.admin && total > 0 && !done && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-300">Шинэ</span>}
                    </p>
                    {t.intro && <p className="mt-0.5 line-clamp-2 text-sm text-neutral-400">{t.intro}</p>}
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                      {t.lesson.length > 0 && (
                        <span className="flex items-center gap-1">
                          <BookOpen size={13} /> Хичээл{pics > 0 && ` · ${pics} зураг`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ListChecks size={13} /> {t.problems.length} бодлого
                      </span>
                      {pics === 0 && t.problems.some((p) => p.img) && (
                        <span className="flex items-center gap-1">
                          <ImageIcon size={13} /> зурагтай
                        </span>
                      )}
                    </p>
                    {!session.admin && total > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
                          <div className="h-full rounded-full bg-violet-400" style={{width: `${(done / total) * 100}%`}} />
                        </div>
                        <span className="text-xs tabular-nums text-neutral-400">
                          {done}/{total}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
