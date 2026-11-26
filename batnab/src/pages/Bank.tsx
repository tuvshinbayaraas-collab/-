import {CheckCircle2, Library, XCircle} from 'lucide-react';
import {useEffect, useState} from 'react';
import MathText from '../components/MathText';
import {InactiveNote, LockedNote} from '../components/Notices';
import {Rich} from '../components/TopicParts';
import Loading from '../components/Loading';
import {answerBank, bankKey, useBankAnswers, useBankImage, useFolderProblems, usePublishedFolders, within, type BankAnswer, type BankFolder, type BankProblem} from '../lib/bank';
import {navigate, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {LETTER_LABELS, lettersOf, problemNos, verdict, type Letter} from '../lib/topics';
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
          <BankCard key={p.id} p={p} num={nos[i]} uid={uid} answer={answers[p.id]} />
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

/** One problem to solve: its picture or text, its choices or a box to write in; once answered, right or wrong. */
function BankCard({p, num, uid, answer}: {p: BankProblem; num: number; uid: string | null; answer?: BankAnswer}) {
  const url = useBankImage(p.img);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The right answer: undefined until known, null when the teacher hasn't given one.
  const [key, setKey] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (answer && key === undefined) void bankKey(p).then(setKey);
  }, [answer, key, p]);
  const letters = lettersOf(p);
  const send = async () => {
    if (!uid || !pick.trim()) return;
    setBusy(true);
    setError('');
    try {
      setKey(await answerBank(uid, p, p.kind === 'choice' ? pick : pick.trim()));
    } catch (e) {
      setError(`Илгээж чадсангүй: ${(e as Error).message}`);
    }
    setBusy(false);
  };
  const mine = answer?.a;
  const ok = mine !== undefined && key !== undefined ? verdict(mine, key) : undefined;
  const shownKey = key ? (p.kind === 'choice' ? (LETTER_LABELS[key as Letter] ?? key) : key) : null;
  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 sm:p-5 ${ok === true ? 'ring-1 ring-green-500/40' : ok === false ? 'ring-1 ring-red-500/40' : ''}`} data-bank-card={p.id}>
      <p className="font-bold">{num}-р бодлого</p>
      {p.img &&
        (url ? (
          <img src={url} alt={`${num}-р бодлогын зураг`} className="mt-3 w-full rounded-lg bg-white object-contain" />
        ) : (
          <div className="mt-3 h-32 animate-pulse rounded-lg bg-neutral-800" />
        ))}
      {p.text && <Rich text={p.text} className="mt-2" />}
      <div className="mt-4">
        {p.kind === 'choice' ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Хариулт сонгох">
            {letters.map((l) => {
              const text = p.choices?.[l];
              const picked = (mine ?? pick) === l;
              const right = mine !== undefined && key === l;
              // Wrong only when a right answer is known; without one the pick stays plain blue.
              const wrong = mine !== undefined && !!key && picked && !right;
              const tone =
                mine !== undefined
                  ? right
                    ? 'border-green-500 bg-green-500/15'
                    : wrong
                      ? 'border-red-500 bg-red-500/15'
                      : picked
                        ? 'border-blue-500 bg-blue-500/15'
                        : 'border-neutral-800 opacity-60'
                  : picked
                    ? 'border-blue-500 bg-blue-500/15'
                    : 'border-neutral-700 hover:border-neutral-500';
              return (
                <button
                  key={l}
                  type="button"
                  disabled={mine !== undefined || !uid}
                  aria-pressed={picked}
                  onClick={() => setPick(l)}
                  className={`flex min-w-[4.5rem] flex-[1_1_auto] items-center gap-2 rounded-xl border px-3 py-2 text-left ${tone}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${right ? 'bg-green-500 text-black' : wrong ? 'bg-red-500 text-black' : picked ? 'bg-blue-500 text-black' : 'bg-neutral-800'}`}>{LETTER_LABELS[l]}</span>
                  {text && <MathText text={text} className="min-w-0 [overflow-wrap:anywhere]" />}
                </button>
              );
            })}
          </div>
        ) : mine !== undefined ? (
          <p className="rounded-xl bg-neutral-800/60 px-3 py-2 text-sm">
            Таны хариулт: <span className="font-semibold">{mine}</span>
          </p>
        ) : (
          <input
            value={pick}
            onChange={(e) => setPick(e.target.value.slice(0, 300))}
            onKeyDown={(e) => e.key === 'Enter' && void send()}
            disabled={!uid}
            placeholder="Хариултаа бичнэ үү"
            aria-label={`${num}-р бодлогын хариулт`}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-blue-500"
          />
        )}
      </div>
      {mine === undefined ? (
        uid ? (
          <button type="button" onClick={() => void send()} disabled={busy || !pick.trim()} className="mt-3 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
            {busy ? 'Шалгаж байна…' : 'Шалгах'}
          </button>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">Сурагч энд хариултаа сонгоод «Шалгах» дарна.</p>
        )
      ) : key === undefined ? (
        <p className="mt-3 text-sm text-neutral-400">Шалгаж байна…</p>
      ) : ok === null ? (
        <p className="mt-3 text-sm text-neutral-300" role="status">
          Хариултаа илгээлээ. Багш энэ бодлогын зөв хариултыг оруулаагүй байна.
        </p>
      ) : (
        <p className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${ok ? 'text-green-300' : 'text-red-300'}`} role="status">
          {ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
          {ok ? 'Зөв!' : `Буруу. Зөв хариулт: ${shownKey}`}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </li>
  );
}
