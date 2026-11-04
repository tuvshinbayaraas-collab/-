import {ArrowRight, Clock, Crown, ListOrdered, Trophy} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import Avatar from '../components/Avatar';
import {CenterNote, LockedNote} from '../components/Notices';
import {animalOf, overall, PLACES, percentOf, ranking, roundLabel, usePhotos, useRoundBoard, useWeekBoard, weekKey, weekLabel, type Entry} from '../lib/leaderboard';
import {MedalArt} from '../components/MedalBadge';
import {serverNow} from '../lib/time';
import {useKeys} from '../lib/keys';
import {usePrefs} from '../lib/prefs';
import {useMyResults} from '../lib/results';
import {Link, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {roundLength, roundNo, roundStart, until, untilReset} from '../lib/week';
import {TESTS, testInfo} from '../tests';
import Loading from '../components/Loading';

type Tab = 'test' | 'overall';

/**
 * The top 3, by test (this week) or by highest score (this two-week round, with its medals), where the student
 * stands, and the rules of the order. Few on the board: compact cards instead of an empty podium.
 */
export default function Leaderboard() {
  const session = useSession();
  const settings = useSettings();
  const prefs = usePrefs();
  const {query} = useLocation();
  const [tab, setTab] = useState<Tab>(query.get('test') || query.get('tab') === 'test' ? 'test' : 'overall');
  const [test, setTest] = useState(testInfo(query.get('test') ?? '')?.id ?? TESTS[0].id);
  const signedIn = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  const on = signedIn && !!settings?.leaderboard;
  const board = useWeekBoard(on);
  const round = useRoundBoard(on);
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);

  const pick = (t: Tab, id = test) => {
    setTab(t);
    setTest(id);
    history.replaceState(null, '', t === 'test' ? `/leaderboard?test=${id}` : '/leaderboard');
  };

  if (session.ready && !session.user) return <LockedNote title="Leaderboard" text="Leaderboard-ийг харахын тулд нэвтэрнэ үү." />;
  if (settings && !settings.leaderboard) return <CenterNote title="Leaderboard одоогоор хаалттай байна" />;
  if (!session.ready || !settings || (signedIn && (!board || !round))) return <Loading />;
  if (!signedIn || !board || !round) return <CenterNote title="Leaderboard-ийг харах боломжгүй" />;

  const list = tab === 'test' ? ranking(board[test] ?? []) : overall(round);
  const uid = session.user!.uid;
  const mine = list.findIndex((e) => e.uid === uid);
  const counts = Object.fromEntries(TESTS.map((t) => [t.id, ranking(board[t.id] ?? []).length]));
  // The student's own results behind this tab (to explain why they aren't on it).
  const taken = (results ?? []).filter((r) => tab === 'overall' || r.test === test);
  const start = roundStart(serverNow());
  const no = roundNo(start);
  const [, animalOf_, sign] = animalOf(no);

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Trophy size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-neutral-400">Тест өгөх бүрт жагсаалт шууд шинэчлэгдэнэ.</p>
        </div>
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

      {/* When this board's contest ends, said plainly. */}
      <p className="mt-3 flex items-center gap-1.5 text-sm text-neutral-300">
        <Clock size={15} className="shrink-0 text-neutral-500" />
        {tab === 'test' ? (
          <span>
            Энэ долоо хоногийн тэмцээн ({weekLabel(Number(weekKey()))}) дуусахад <b>{untilReset()}</b>
          </span>
        ) : no ? (
          <span>
            {no}-р тойрог ({roundLabel(start)}) дуусахад <b>{until(start + roundLength(start))}</b>
          </span>
        ) : (
          <span>
            Энэ долоо хоногийн тэмцээн дуусахад <b>{untilReset()}</b>
          </span>
        )}
      </p>

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

      {tab === 'overall' && no > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="flex shrink-0 -space-x-3">
            {([1, 2, 3] as const).map((p) => (
              <MedalArt key={p} place={p} round={no} size={34} />
            ))}
          </div>
          <p className="min-w-0 text-sm">
            <span className="font-semibold">
              Энэ тойргийн шагнал: {animalOf_} медаль {sign}
            </span>
            <span className="block text-xs text-neutral-400">Эхний 3 байрт — алт, мөнгө, хүрэл</span>
          </p>
        </div>
      )}

      {list.length >= 3 ? (
        <Podium top={list.slice(0, 3)} showTest={tab === 'overall'} me={uid} />
      ) : (
        <Few
          list={list}
          showTest={tab === 'overall'}
          me={uid}
          empty={tab === 'test' ? 'Энэ долоо хоногт энэ тестийг хараахан хэн ч өгөөгүй байна.' : 'Энэ тойрогт хараахан хэн ч оноо аваагүй байна.'}
        />
      )}

      {list.length > 0 && <p className="mt-3 text-center text-xs text-neutral-500">{list.length} сурагч оролцож байна</p>}

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
              showTest={tab === 'overall'}
              note={mine < 3 ? (tab === 'test' ? 'Эхний 3-т байна!' : `Эхний 3-т байна! Тойргийн эцэс хүртэл хадгалбал ${animalOf_.toLowerCase()} медаль авна.`) : undefined}
            />
          )}
        </div>
      )}

      <details className="mt-4 rounded-2xl bg-neutral-900 px-4 py-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <ListOrdered size={16} className="text-blue-300" /> Эрэмбийн дүрэм
        </summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral-300 marker:text-neutral-600">
          <li>
            <b>Тест тус бүрээр</b>: тест бүрт энэ долоо хоногт өгсөн оролдлогуудаас тань хамгийн сайн нэг нь орно. Баасан гаригийн 24:00-д шинээр эхэлнэ.
          </li>
          <li>
            <b>Шилдэг оноогоор</b>: 2 долоо хоногийн тойрогт аль ч тестээр авсан хамгийн сайн <b>нэг</b> дүн тань (нийлбэр биш).
          </li>
          <li>
            <b>Медаль</b>: тойрог бүрийн эцэст «Шилдэг оноогоор»-ын эхний 3 нь тэр тойргийн амьтны (12 жилийн дарааллаар) алт, мөнгө, хүрэл медаль авч, профайлд нь үүрд үлдэнэ.
          </li>
          <li>
            Эрэмбэ: эхлээд <b>хувь</b> (зөв ÷ шалгагдсан бодлого), тэнцвэл <b>зөв хариултын тоо</b>, түүнд ч тэнцвэл тэр оноог <b>түрүүлж авсан</b> нь дээр.
          </li>
          <li>0 оноо, багш түлхүүрийг нь оруулаагүй тестийн оноо орохгүй. Бусдад зөвхөн nickname (эсвэл @нэвтрэх нэр) харагдана.</li>
        </ul>
      </details>
    </div>
  );
}

/** One or two on the board (or none): a card each, no empty steps. */
function Few({list, showTest, me, empty}: {list: Entry[]; showTest: boolean; me: string; empty: string}) {
  const photos = usePhotos(list.map((e) => e.uid));
  if (!list.length) return <p className="mt-4 rounded-2xl bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-400">{empty}</p>;
  return (
    <ol className="mt-4 space-y-2">
      {list.map((e, i) => {
        const look = PLACES[(i + 1) as 1 | 2 | 3];
        return (
          <li key={e.uid}>
            <Link href={`/u/${e.uid}`} className={`flex items-center gap-3 rounded-2xl p-3 hover:opacity-90 ${look.block}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${look.badge}`}>{i + 1}</span>
              <span className={`rounded-full ring-2 ${look.ring}`}>
                <Avatar name={e.name.replace(/^@/, '')} photo={photos[e.uid]} size={40} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${e.uid === me ? 'text-blue-300' : ''}`}>{e.name}</span>
                <span className="block text-xs text-neutral-400">
                  {e.score}/{e.total} · {percentOf(e)}%{showTest && ` · ${testInfo(e.test)?.title}`}
                </span>
              </span>
              {i === 0 && <Crown size={20} className={`shrink-0 ${look.text}`} />}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function MyRow({e, place, gap, showTest, note}: {e: Entry; place: number; gap: number; showTest: boolean; note?: string}) {
  const look = place <= 3 ? PLACES[place as 1 | 2 | 3] : null;
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${look ? look.badge : 'bg-neutral-800'}`}>{place}</span>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${look ? look.text : ''}`}>Таны байр: {place}</p>
        <p className="text-neutral-400">
          {e.score}/{e.total} ({percentOf(e)}%){showTest && ` · ${testInfo(e.test)?.title}`}
          {note ? ` · ${note}` : ` · ${gap > 0 ? `эхний 3-т орохын тулд ${gap} оноо дутуу` : 'оноо тэнцүү, гэхдээ өмнө нь авсан нь дээр'}`}
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
