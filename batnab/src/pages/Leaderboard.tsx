import {ArrowRight, CircleHelp, Crown, Trophy} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import Avatar from '../components/Avatar';
import {CenterNote, LockedNote} from '../components/Notices';
import {animalOf, overall, PLACES, percentOf, ranking, usePhotos, useWeekBoard, type Entry} from '../lib/leaderboard';
import {MedalArt, OrderArt} from '../components/MedalBadge';
import {serverNow} from '../lib/time';
import {useKeys} from '../lib/keys';
import {usePrefs} from '../lib/prefs';
import {useMyResults} from '../lib/results';
import {Link, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {untilReset, weekNo, weekStart} from '../lib/week';
import {TESTS, testInfo} from '../tests';
import Loading from '../components/Loading';

type Tab = 'test' | 'overall';

/**
 * This week's top 3 on a podium, by test (each test's top 3 get this week's animal medals) or by every test's best added
 * up (the top 3 get the «Шилдэг» orders), the prize in the podium's corner, and where the student stands; the rules of
 * the order behind "?".
 */
export default function Leaderboard() {
  const session = useSession();
  const settings = useSettings();
  const prefs = usePrefs();
  const {query} = useLocation();
  const [tab, setTab] = useState<Tab>(query.get('test') || query.get('tab') === 'test' ? 'test' : 'overall');
  const [test, setTest] = useState(testInfo(query.get('test') ?? '')?.id ?? TESTS[0].id);
  const [rules, setRules] = useState(false);
  const signedIn = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  const on = signedIn && !!settings?.leaderboard;
  const board = useWeekBoard(on);
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);

  const pick = (t: Tab, id = test) => {
    setTab(t);
    setTest(id);
    history.replaceState(null, '', t === 'test' ? `/leaderboard?test=${id}` : '/leaderboard');
  };

  if (session.ready && !session.user) return <LockedNote title="Leaderboard" text="Leaderboard-ийг харахын тулд нэвтэрнэ үү." />;
  if (settings && !settings.leaderboard) return <CenterNote title="Leaderboard одоогоор хаалттай байна" />;
  if (!session.ready || !settings || (signedIn && !board)) return <Loading />;
  if (!signedIn || !board) return <CenterNote title="Leaderboard-ийг харах боломжгүй" />;

  const sum = tab === 'overall';
  const list = sum ? overall(board) : ranking(board[test] ?? []);
  const uid = session.user!.uid;
  const mine = list.findIndex((e) => e.uid === uid);
  const counts = Object.fromEntries(TESTS.map((t) => [t.id, ranking(board[t.id] ?? []).length]));
  // The student's own results behind this tab (to explain why they aren't on it).
  const taken = (results ?? []).filter((r) => tab === 'overall' || r.test === test);
  const no = weekNo(weekStart(serverNow()));
  const prize = sum ? 'Шилдэгийн одон' : no ? `${animalOf(no)[1].toLowerCase()} медаль` : 'медаль';

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-6">
      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Trophy size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-neutral-400">
            Энэ долоо хоног дуусахад <b className="whitespace-nowrap text-neutral-200">{untilReset()}</b>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRules((r) => !r)}
          aria-expanded={rules}
          aria-label="Эрэмбийн дүрэм"
          title="Эрэмбийн дүрэм"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${rules ? 'bg-blue-500/20 text-blue-200' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
        >
          <CircleHelp size={20} />
        </button>
        {rules && <Rules onClose={() => setRules(false)} />}
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-full bg-neutral-900 p-1 text-sm font-medium" role="tablist">
        {(
          [
            ['test', 'Тест тус бүрээр'],
            ['overall', 'Шилдэг оноогоор'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => pick(t)}
            className={`rounded-full py-2 ${tab === t ? 'bg-blue-500/20 text-blue-100 ring-1 ring-blue-400/40' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
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

      <Podium
        top={list.slice(0, 3)}
        sum={sum}
        me={uid}
        badge={
          sum ? (
            <>
              <OrderArt place={1} size={20} /> Шилдэгийн одон
            </>
          ) : no > 0 ? (
            <>
              <MedalArt place={1} round={no} size={20} /> Энэ долоо хоногийн медаль
            </>
          ) : null
        }
      />

      <p className="mt-3 text-center text-xs text-neutral-500">
        {list.length ? `${list.length} сурагч оролцож байна` : tab === 'test' ? 'Энэ долоо хоногт энэ тестийг хараахан хэн ч өгөөгүй байна.' : 'Энэ долоо хоногт хараахан хэн ч оноо аваагүй байна.'}
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
            taken.length > 0 && taken.every((r) => keys[r.test] === null) ? (
              <p className="text-neutral-400">Багш түлхүүрийг оруулаагүй тул оноо тань хараахан тооцогдоогүй байна. Оруулмагц энд гарна.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Анхны оноогоо аваарай</span>
                  <span className="block text-neutral-400">Тестээ өгөөд жагсаалтад нэгдээрэй.</span>
                </span>
                <Link
                  href={`/test/${tab === 'test' ? test : (TESTS.find((t) => !taken.some((r) => r.test === t.id)) ?? TESTS[0]).id}`}
                  className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-2 font-semibold text-black hover:bg-blue-400"
                >
                  Тест эхлэх <ArrowRight size={16} />
                </Link>
              </div>
            )
          ) : (
            <MyRow
              e={list[mine]}
              place={mine + 1}
              gap={mine >= 3 ? list[2].score - list[mine].score : 0}
              sum={sum}
              note={mine < 3 ? `Эхний 3-т байна! Долоо хоногийн эцэс хүртэл хадгалбал ${prize} авна.` : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MyRow({e, place, gap, sum, note}: {e: Entry; place: number; gap: number; sum: boolean; note?: string}) {
  const look = place <= 3 ? PLACES[place as 1 | 2 | 3] : null;
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${look ? look.badge : 'bg-neutral-800'}`}>{place}</span>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${look ? look.text : ''}`}>Таны байр: {place}</p>
        <p className="text-neutral-400">
          {sum ? `Нийт ${e.score} оноо · ${e.tests?.length ?? 1} тест` : `${e.score}/${e.total} (${percentOf(e)}%)`}
          {note ? ` · ${note}` : ` · ${gap > 0 ? `эхний 3-т орохын тулд ${gap} оноо дутуу` : sum ? 'оноо тэнцүү: 1 оноо нэмбэл эхний 3-т орно' : 'оноо тэнцүү, гэхдээ өмнө нь авсан нь дээр'}`}
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

/** 2nd, 1st, 3rd side by side, the winner highest; `badge`: the prize, in the top-right corner. */
function Podium({top, sum, me, badge}: {top: Entry[]; sum: boolean; me: string; badge: ReactNode}) {
  const photos = usePhotos(top.map((e) => e.uid));
  const slots = [
    {place: 2, h: 'h-16', size: 56},
    {place: 1, h: 'h-24', size: 72},
    {place: 3, h: 'h-12', size: 56},
  ] as const;
  return (
    <div className={`relative mt-5 grid grid-cols-3 items-end gap-2 overflow-hidden rounded-3xl bg-neutral-900 px-3 pb-0 ${badge ? 'pt-12' : 'pt-6'}`}>
      {badge && (
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-amber-400/10 py-0.5 pl-1 pr-2.5 text-[11px] font-semibold text-amber-200" title="Эхний 3-т">
          {badge}
        </span>
      )}
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
            <p className="text-xs text-neutral-400">{e ? (sum ? `${e.score} оноо` : `${e.score}/${e.total} · ${percentOf(e)}%`) : ' '}</p>
            {sum && e && <p className="w-full truncate text-[11px] text-neutral-500">{e.tests?.length ?? 1} тест</p>}
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

/** The rules of the order, opened from the "?" by the title. */
function Rules({onClose}: {onClose: () => void}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label="Эрэмбийн дүрэм" className="absolute right-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-neutral-800 p-4 text-sm shadow-xl">
        <p className="font-semibold">Эрэмбийн дүрэм</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral-300 marker:text-neutral-500">
          <li>
            <b>Тест тус бүрээр</b>: тест бүрт энэ долоо хоногт өгсөн оролдлогуудаас тань хамгийн сайн нэг нь. Эрэмбэ: эхлээд <b>хувь</b>, тэнцвэл <b>зөв хариултын тоо</b>, түүнд ч тэнцвэл тэр оноог{' '}
            <b>түрүүлж авсан</b> нь дээр.
          </li>
          <li>
            <b>Шилдэг оноогоор</b>: энэ долоо хоногт өгсөн бүх тестийн тань хамгийн сайн оноог <b>нийлүүлнэ</b> — олон тест өгөх тусам нэмэгдэнэ. Эрэмбэ: эхлээд <b>нийт оноо</b>, тэнцвэл <b>хувь</b>,
            түүнд ч тэнцвэл <b>түрүүлж хүрсэн</b> нь дээр.
          </li>
          <li>
            <b>Медаль</b>: долоо хоног бүрийн эцэст тест бүрийн эхний 3 нь тэр долоо хоногийн амьтны (12 жилийн дарааллаар) алт, мөнгө, хүрэл медаль, «Шилдэг оноогоор»-ын эхний 3 нь
            <b> Шилдэгийн одон</b> (алтан, мөнгөн, хүрэл) авна.
          </li>
          <li>0 оноо, түлхүүргүй тестийн оноо орохгүй. Бусдад зөвхөн nickname харагдана.</li>
        </ul>
      </div>
    </>
  );
}
