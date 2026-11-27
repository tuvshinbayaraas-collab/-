import {Library} from 'lucide-react';
import {useState} from 'react';
import {InactiveNote, LockedNote} from '../components/Notices';
import SolveCard from '../components/SolveCard';
import Loading from '../components/Loading';
import {answerBank, bankKey, useBankAnswers, useFolderProblems, usePublishedFolders, within, type BankAnswer, type BankFolder} from '../lib/bank';
import {navigate, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {problemNos} from '../lib/topics';
import {BankPath, FolderButton} from './admin/BankParts';

/** Problems shown at once (a big folder is shown in parts, its pictures loaded as they come). */
const PART = 20;
const go = (fid: string) => navigate(fid ? `/bank?folder=${encodeURIComponent(fid)}` : '/bank');

/**
 * /bank «Бодлогын сан»: the folders of problems the teacher has published, folders in folders, and their problems to
 * solve: a choice or a written answer, checked against the right answer (read only once answered, as in a topic).
 */
export default function Bank() {
  const session = useSession();
  const at = useLocation().query.get('folder') ?? '';
  const ok = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  const folders = usePublishedFolders(ok);
  const answers = useBankAnswers(ok && !session.admin ? session.user!.uid : null);
  if (!session.ready) return <Loading />;
  if (!session.user) return <LockedNote text="Бодлогын санг үзэхийн тулд нэвтэрнэ үү." />;
  if (!session.admin && (!session.profile || session.profile.disabled)) return <InactiveNote blocked={!!session.profile?.disabled} />;
  const folder = folders?.find((f) => f.id === at);
  const kids = folders?.filter((f) => f.parent === at) ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-4 sm:py-6" data-student-bank>
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
          <Library size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Бодлогын сан</h1>
          <p className="text-sm text-neutral-400">
            {session.admin ? 'Сурагчид ингэж харна: зөвхөн нийтэлсэн хавтсууд. Засах бол багшийн самбарын «Бодлого» хэсэгт орно.' : 'Багшийн нийтэлсэн бодлогууд. Хүссэнээ сонгоод бодоорой.'}
          </p>
        </div>
      </header>
      {!folders ? (
        <Loading small />
      ) : at && !folder ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">
          Энэ хавтас олдсонгүй.{' '}
          <button type="button" onClick={() => go('')} className="text-blue-400 underline">
            Сан руу буцах
          </button>
        </p>
      ) : !folders.length ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">Багш одоогоор бодлого нийтлээгүй байна.</p>
      ) : (
        <>
          <BankPath folders={folders} at={at} onGo={go} top="Бодлогын сан" />
          {folder && <h2 className="text-xl font-semibold">{folder.name}</h2>}
          {kids.length > 0 && (
            <section className="space-y-2" aria-label="Хавтсууд">
              <div className="grid gap-2 sm:grid-cols-2">
                {kids.map((f) => (
                  <FolderButton key={f.id} f={f} folders={within(folders, f.id).length} onOpen={() => go(f.id)} />
                ))}
              </div>
            </section>
          )}
          {folder && <FolderProblems folder={folder} uid={session.admin ? null : session.user.uid} answers={answers ?? {}} />}
        </>
      )}
    </div>
  );
}

function FolderProblems({folder, uid, answers}: {folder: BankFolder; uid: string | null; answers: Record<string, BankAnswer>}) {
  const list = useFolderProblems(folder.id);
  const [shown, setShown] = useState(PART);
  if (!list) return <Loading small />;
  if (!list.length) return <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Энэ хавтсанд бодлого алга.</p>;
  const done = list.filter((p) => answers[p.id]).length;
  const nos = problemNos(list);
  return (
    <section className="space-y-3" aria-label="Бодлогууд">
      <p className="text-sm text-neutral-400" data-bank-progress>
        {list.length} бодлого{uid ? ` · ${done} бодсон` : ''}
      </p>
      <ol className="space-y-3">
        {list.slice(0, shown).map((p, i) => (
          <SolveCard key={p.id} p={p} num={nos[i]} uid={uid} answer={answers[p.id]} send={(a) => answerBank(uid!, p, a)} readKey={() => bankKey(p)} />
        ))}
      </ol>
      {list.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PART)} className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-medium text-blue-300 hover:bg-neutral-800" data-more>
          Цааш үзэх ({list.length - shown} бодлого үлдсэн)
        </button>
      )}
    </section>
  );
}
