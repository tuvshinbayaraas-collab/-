import {Crown, Medal as MedalIcon, Trophy} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import Avatar from '../components/Avatar';
import {CenterNote, LockedNote} from '../components/Notices';
import {overall, PLACES, percentOf, ranking, usePhotos, useWeekBoard, weekKey, weekLabel, type Entry} from '../lib/leaderboard';
import {useKeys} from '../lib/keys';
import {usePrefs} from '../lib/prefs';
import {useMyResults} from '../lib/results';
import {Link, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {untilReset} from '../lib/week';
import {TESTS, testInfo} from '../tests';

type Tab = 'test' | 'overall';

/** This week's top 3, by test or by highest score, and where the student stands. */
export default function Leaderboard() {
  const session = useSession();
  const settings = useSettings();
  const prefs = usePrefs();
  const {query} = useLocation();
  const [tab, setTab] = useState<Tab>(query.get('test') || query.get('tab') === 'test' ? 'test' : 'overall');
  const [test, setTest] = useState(testInfo(query.get('test') ?? '')?.id ?? TESTS[0].id);
  const signedIn = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  const board = useWeekBoard(signedIn && !!settings?.leaderboard);
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);

  const pick = (t: Tab, id = test) => {
    setTab(t);
    setTest(id);
    history.replaceState(null, '', t === 'test' ? `/leaderboard?test=${id}` : '/leaderboard');
  };

  if (session.ready && !session.user) return <LockedNote title="Leaderboard" text="Leaderboard-ийг харахын тулд нэвтэрнэ үү." />;
  if (settings && !settings.leaderboard) return <CenterNote title="Leaderboard одоогоор хаалттай байна" />;
  if (!session.ready || !settings || (signedIn && !board)) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!signedIn || !board) return <CenterNote title="Leaderboard-ийг харах боломжгүй" />;

  const list = tab === 'test' ? ranking(board[test] ?? []) : overall(board);
  const uid = session.user!.uid;
  const mine = list.findIndex((e) => e.uid === uid);
  const counts = Object.fromEntries(TESTS.map((t) => [t.id, ranking(board[t.id] ?? []).length]));
  // The student's own results behind this tab (to explain why they aren't on it).
  const taken = (results ?? []).filter((r) => tab === 'overall' || r.test === test);

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Trophy size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-neutral-400">
            {weekLabel(Number(weekKey()))} · шинэчлэгдэхэд {untilReset()}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-full bg-neutral-900 p-1 text-sm font-medium" role="tablist">
        {(
          [
            ['test', 'Тестээр'],
            ['overall', 'Хамгийн өндөр оноо'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => pick(t)} className={`rounded-full py-2 ${tab === t ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'test' && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {TESTS.map((t) => (
            <button
              key={t.id}
              onClick={() => pick('test', t.id)}
              aria-pressed={test === t.id}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${test === t.id ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-neutral-800 text-neutral-300 hover:border-neutral-600'}`}
            >
              {t.title} <span className="text-neutral-500">{counts[t.id]}</span>
            </button>
          ))}
        </div>
      )}

      <Podium top={list.slice(0, 3)} showTest={tab === 'overall'} me={uid} />

      <p className="mt-3 text-center text-xs text-neutral-500">
        {list.length ? `${list.length} сурагч оролцож байна` : tab === 'test' ? 'Энэ долоо хоногт энэ тестийг хараахан хэн ч өгөөгүй байна.' : 'Энэ долоо хоногт хараахан хэн ч тест өгөөгүй байна.'}
      </p>

      {!session.admin && (
        <div className="mt-4 rounded-2xl bg-neutral-900 p-4 text-sm">
          {prefs.lbOff ? (
            <p className="text-neutral-400">
              Та оноогоо leaderboard-д харуулахгүй гэж тохируулсан.{' '}
              <Link href="/settings" className="text-blue-400 hover:underline">
                Тохиргоо
              </Link>
            </p>
          ) : mine < 0 ? (
            <p className="text-neutral-400">
              {taken.length === 0
                ? `Та ${tab === 'test' ? `${testInfo(test)!.title}-ийг` : 'тест'} энэ долоо хоногт хараахан өгөөгүй байна. `
                : taken.every((r) => keys[r.test] === null)
                  ? 'Багш түлхүүрийг оруулаагүй тул оноо тань хараахан тооцогдоогүй байна. '
                  : 'Оноо тань 0 байгаа тул leaderboard-д ороогүй. Дахин өгөөд үзээрэй! '}
              <Link href={tab === 'test' ? `/test/${test}` : '/'} className="text-blue-400 hover:underline">
                Тест өгөх
              </Link>
            </p>
          ) : mine < 3 ? (
            <p className={`font-semibold ${PLACES[(mine + 1) as 1 | 2 | 3].text}`}>
              {tab === 'test' ? `Та энэ тестээр ${mine + 1}-р байрт байна!` : `Та ${mine + 1}-р байрт байна! Энэ байраа долоо хоногийн эцэс хүртэл хадгалбал медаль авна.`}
            </p>
          ) : (
            <MyRow e={list[mine]} place={mine + 1} gap={list[2].score - list[mine].score} showTest={tab === 'overall'} />
          )}
        </div>
      )}

      <p className="mt-6 flex items-start justify-center gap-1.5 text-center text-xs text-neutral-500">
        <MedalIcon size={14} className="mt-px shrink-0" /> Долоо хоногийн эцэст «Хамгийн өндөр оноо»-ны эхний 3 сурагч медаль авч, профайлд нь харагдана.
      </p>
    </div>
  );
}

function MyRow({e, place, gap, showTest}: {e: Entry; place: number; gap: number; showTest: boolean}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-bold">{place}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Таны байр: {place}</p>
        <p className="text-neutral-400">
          {e.score}/{e.total} ({percentOf(e)}%){showTest && ` · ${testInfo(e.test)?.title}`} · {gap > 0 ? `эхний 3-т орохын тулд ${gap} оноо дутуу` : 'оноо тэнцүү, гэхдээ өмнө нь авсан нь дээр'}
        </p>
      </div>
    </div>
  );
}

/** A podium student's photo and name open their profile (the real name stays hidden). */
const Who = ({uid, children}: {uid: string; children: ReactNode}) => (
  <Link href={`/u/${uid}`} className="flex w-full min-w-0 flex-col items-center rounded-2xl hover:opacity-90" aria-label="Профайл харах">
    {children}
  </Link>
);

/** 2nd, 1st, 3rd side by side; the winner stands highest. */
function Podium({top, showTest, me}: {top: Entry[]; showTest: boolean; me: string}) {
  const photos = usePhotos(top.map((e) => e.uid));
  const slots = [
    {place: 2, h: 'h-16', size: 56},
    {place: 1, h: 'h-24', size: 72},
    {place: 3, h: 'h-12', size: 56},
  ] as const;
  return (
    <div className="mt-5 grid grid-cols-3 items-end gap-2 rounded-3xl bg-neutral-900 px-3 pb-0 pt-6">
      {slots.map(({place, h, size}) => {
        const e = top[place - 1];
        const look = PLACES[place];
        return (
          <div key={place} className="flex min-w-0 flex-col items-center text-center">
            {place === 1 && <Crown size={22} className={`mb-1 ${e ? look.text : 'text-neutral-700'}`} />}
            {e ? (
              <Who uid={e.uid}>
                <span className={`rounded-full ring-4 ${look.ring}`}>
                  <Avatar name={e.name.replace(/^@/, '')} photo={photos[e.uid]} size={size} />
                </span>
                <p className={`mt-3 line-clamp-2 w-full break-words text-sm font-semibold leading-tight ${e.uid === me ? 'text-blue-300' : ''}`}>{e.name}</p>
              </Who>
            ) : (
              <>
                <span className="rounded-full border-2 border-dashed border-neutral-700" style={{width: size, height: size}} />
                <p className="mt-3 text-sm font-semibold">—</p>
              </>
            )}
            <p className="text-xs text-neutral-400">{e ? `${e.score}/${e.total} · ${percentOf(e)}%` : ' '}</p>
            {showTest && e && <p className="w-full truncate text-[11px] text-neutral-500">{testInfo(e.test)?.title}</p>}
            {e && (
              <Link href={`/u/${e.uid}`} className="mt-1 text-[11px] font-medium text-blue-400 hover:underline">
                Профайл харах
              </Link>
            )}
            <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-2 ${h} ${look.block}`}>
              <span className={`text-xl font-extrabold ${look.text}`}>{place}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
